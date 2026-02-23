import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { revalidatePath } from "next/cache";

const userSelect = { id: true, name: true, image: true, position: true, number: true };

// 팀 운동 상세 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // includeSessions 파라미터 확인
    const url = new URL(req.url);
    const includeSessions = url.searchParams.get("includeSessions") === "true";

    // 기본 정보만 로드 (빠른 응답) - sessions는 옵션
    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            mapUrl: true,
            latitude: true,
            longitude: true,
          },
        },
        vestBringer: { select: userSelect },
        vestReceiver: { select: userSelect },
        rsvps: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        },
        checkIns: {
          include: { user: { select: userSelect } },
          orderBy: { checkedInAt: "asc" },
        },
        // 친선경기 관련
        matchRules: true,
        linkedEvent: {
          select: {
            id: true,
            title: true,
            teamId: true,
            date: true,
            location: true,
            challengeToken: true,
            team: { select: { id: true, name: true, logoUrl: true } },
            _count: { select: { rsvps: { where: { status: "ATTEND" } } } },
          },
        },
        opponentTeam: {
          select: { id: true, name: true, logoUrl: true, eloRating: true, primaryColor: true },
        },
        refereeAssignment: {
          include: {
            quarterReferees: {
              include: { user: { select: userSelect } },
              orderBy: { quarter: "asc" },
            },
          },
        },
        goalRecords: {
          include: {
            scorer: { select: userSelect },
            assistant: { select: userSelect },
            recordedBy: { select: userSelect },
          },
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
        },
        playerSubstitutions: {
          include: {
            playerOut: { select: userSelect },
            playerIn: { select: userSelect },
            recordedBy: { select: userSelect },
          },
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
        },
        cardRecords: {
          include: {
            player: { select: userSelect },
            recordedBy: { select: userSelect },
          },
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
        },
        ...(includeSessions && {
          sessions: {
            include: {
              teamAssignments: {
                include: { user: { select: userSelect } },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        }),
      },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const myRsvp = event.rsvps.find((r) => r.userId === session.user.id);
    const myCheckIn = event.checkIns.find((c) => c.userId === session.user.id);

    // 친선경기 상대팀 이벤트인 경우: host 이벤트의 records를 TEAM_A↔B 플립해서 병합
    // (linkedEventId 없고 isFriendlyMatch인 경우 = 상대팀으로 수락된 이벤트)
    if (event.isFriendlyMatch && !event.linkedEventId && event.opponentTeamId) {
      const hostEvent = await prisma.trainingEvent.findFirst({
        where: { linkedEventId: event.id },
        select: {
          id: true,
          challengeToken: true,
          teamAScore: true,
          teamBScore: true,
          matchStatus: true,
          goalRecords: {
            include: { scorer: { select: userSelect }, assistant: { select: userSelect }, recordedBy: { select: userSelect } },
            orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          },
          playerSubstitutions: {
            include: { playerOut: { select: userSelect }, playerIn: { select: userSelect }, recordedBy: { select: userSelect } },
            orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          },
          cardRecords: {
            include: { player: { select: userSelect }, recordedBy: { select: userSelect } },
            orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          },
        },
      });

      if (hostEvent) {
        const flip = (side: "TEAM_A" | "TEAM_B") => (side === "TEAM_A" ? "TEAM_B" : "TEAM_A");
        return NextResponse.json({
          ...event,
          sessions: (event as any).sessions || [],
          myRsvp: myRsvp?.status || null,
          myCheckIn: myCheckIn?.checkedInAt || null,
          // 상대팀 관점: 우리팀=TEAM_A, 상대=TEAM_B → host 이벤트 TEAM_A↔B 뒤집기
          challengeToken: hostEvent.challengeToken, // 리다이렉트용 호스트 토큰
          teamAScore: hostEvent.teamBScore,
          teamBScore: hostEvent.teamAScore,
          matchStatus: hostEvent.matchStatus,
          goalRecords: hostEvent.goalRecords.map((r) => ({ ...r, scoringTeam: flip(r.scoringTeam as "TEAM_A" | "TEAM_B") })),
          playerSubstitutions: hostEvent.playerSubstitutions.map((r) => ({ ...r, teamSide: flip(r.teamSide as "TEAM_A" | "TEAM_B") })),
          cardRecords: hostEvent.cardRecords.map((r) => ({ ...r, teamSide: flip(r.teamSide as "TEAM_A" | "TEAM_B") })),
        });
      }
    }

    return NextResponse.json({
      ...event,
      sessions: (event as any).sessions || [], // includeSessions=true일 때만 포함
      myRsvp: myRsvp?.status || null,
      myCheckIn: myCheckIn?.checkedInAt || null,
    });
  } catch (error) {
    console.error("팀 운동 상세 조회 오류:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: "조회에 실패했습니다", details: errorMessage },
      { status: 500 }
    );
  }
}

// 팀 운동 수정 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await req.json();

    // 구장 처리
    let venueId = event.venueId;
    if (body.location) {
      const locationName = body.location.trim();
      let venue = await prisma.venue.findUnique({
        where: {
          teamId_name: {
            teamId: event.teamId,
            name: locationName,
          },
        },
      });

      if (!venue) {
        // 새 구장 생성
        venue = await prisma.venue.create({
          data: {
            teamId: event.teamId,
            name: locationName,
            address: body.venueData?.address || null,
            mapUrl: body.venueData?.mapUrl || null,
            latitude: body.venueData?.latitude || null,
            longitude: body.venueData?.longitude || null,
            recommendedShoes: Array.isArray(body.shoes) ? body.shoes : [],
            usageCount: 1,
          },
        });
      } else {
        // 기존 구장: 지도 정보 업데이트 (venueData가 제공된 경우)
        if (body.venueData) {
          await prisma.venue.update({
            where: { id: venue.id },
            data: {
              address: body.venueData.address || venue.address,
              mapUrl: body.venueData.mapUrl || venue.mapUrl,
              latitude: body.venueData.latitude || venue.latitude,
              longitude: body.venueData.longitude || venue.longitude,
            },
          });
        }
        // location이 변경된 경우에만 usageCount 증가
        if (locationName !== event.location) {
          await prisma.venue.update({
            where: { id: venue.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }
      venueId = venue.id;
    }

    // 조끼 당번이 다른 사람으로 변경될 때만 이후 운동 체크
    // (같은 값 유지 or 선택안함으로 비우는 것은 허용)
    const newVestBringerId = body.vestBringerId !== undefined ? (body.vestBringerId || null) : undefined;
    const newVestReceiverId = body.vestReceiverId !== undefined ? (body.vestReceiverId || null) : undefined;
    const vestBringerChanged = newVestBringerId !== undefined && newVestBringerId !== null && newVestBringerId !== event.vestBringerId;
    const vestReceiverChanged = newVestReceiverId !== undefined && newVestReceiverId !== null && newVestReceiverId !== event.vestReceiverId;

    if (vestBringerChanged || vestReceiverChanged) {
      const laterEventWithVest = await prisma.trainingEvent.findFirst({
        where: {
          teamId: event.teamId,
          date: { gt: event.date },
          OR: [
            { vestBringerId: { not: null } },
            { vestReceiverId: { not: null } },
          ],
        },
        orderBy: { date: "asc" },
      });

      if (laterEventWithVest) {
        return NextResponse.json(
          { error: "이후 운동에 조끼 당번이 설정되어 있어 수정할 수 없습니다" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.trainingEvent.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.isRegular !== undefined && { isRegular: body.isRegular }),
        ...(body.enablePomVoting !== undefined && { enablePomVoting: body.enablePomVoting }),
        ...(body.pomVotingDeadline !== undefined && { pomVotingDeadline: body.pomVotingDeadline ? new Date(body.pomVotingDeadline) : null }),
        ...(body.pomVotesPerPerson !== undefined && { pomVotesPerPerson: body.pomVotesPerPerson }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.location && { location: body.location }),
        ...(venueId && { venueId }),
        ...(body.shoes !== undefined && { shoes: Array.isArray(body.shoes) ? body.shoes : [] }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.uniform !== undefined && { uniform: body.uniform || null }),
        ...(body.vestBringerId !== undefined && { vestBringerId: body.vestBringerId || null }),
        ...(body.vestReceiverId !== undefined && { vestReceiverId: body.vestReceiverId || null }),
        ...(body.rsvpDeadline && { rsvpDeadline: new Date(body.rsvpDeadline) }),
        // 날씨 정보 업데이트
        ...(body.weatherData && {
          weather: body.weatherData.weather || null,
          weatherDescription: body.weatherData.weatherDescription || null,
          temperature: body.weatherData.temperature || null,
          minTempC: body.weatherData.minTempC || null,
          maxTempC: body.weatherData.maxTempC || null,
          feelsLikeC: body.weatherData.feelsLikeC || null,
          precipMm: body.weatherData.precipMm || null,
          chanceOfRain: body.weatherData.chanceOfRain || null,
          windKph: body.weatherData.windKph || null,
          uvIndex: body.weatherData.uvIndex || null,
          airQualityIndex: body.weatherData.airQualityIndex || null,
          pm25: body.weatherData.pm25 || null,
          pm10: body.weatherData.pm10 || null,
          sunrise: body.weatherData.sunrise || null,
          sunset: body.weatherData.sunset || null,
        }),
        // 친선경기 정보 업데이트
        ...(body.isFriendlyMatch !== undefined && {
          isFriendlyMatch: body.isFriendlyMatch,
          // 일반→친선 전환 시 matchStatus를 DRAFT로 설정 (도전장 발송 가능하도록)
          ...(!event.isFriendlyMatch && body.isFriendlyMatch && { matchStatus: 'DRAFT' }),
        }),
        ...(body.minimumPlayers !== undefined && { minimumPlayers: body.minimumPlayers || null }),
        ...(body.rsvpDeadlineOffset !== undefined && { rsvpDeadlineOffset: body.rsvpDeadlineOffset || null }),
        ...(body.opponentTeam !== undefined && { opponentTeamName: body.isFriendlyMatch ? (body.opponentTeam || null) : null }),
        ...(body.opponentTeamId !== undefined && { opponentTeamId: body.isFriendlyMatch ? (body.opponentTeamId || null) : null }),
      },
    });

    // 조끼 담당자가 변경된 경우 푸시 알림 발송
    try {
      const vestNotifyIds: string[] = [];
      const newBringerId = body.vestBringerId !== undefined ? body.vestBringerId : null;
      const newReceiverId = body.vestReceiverId !== undefined ? body.vestReceiverId : null;

      // 이전 담당자와 다르고, 새로 지정된 경우만 알림 (null이 아닌 경우)
      if (newBringerId && newBringerId !== event.vestBringerId) {
        vestNotifyIds.push(newBringerId);
      }
      if (newReceiverId && newReceiverId !== event.vestReceiverId) {
        vestNotifyIds.push(newReceiverId);
      }

      if (vestNotifyIds.length > 0) {
        // 날짜 포맷 (수정된 날짜 또는 기존 날짜)
        const eventDate = body.date ? new Date(body.date) : event.date;
        const dateStr = eventDate.toLocaleDateString("ko-KR", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        // 가져오는 사람과 가져가는 사람이 같으면 한 번만 알림
        const uniqueIds = [...new Set(vestNotifyIds)];

        for (const userId of uniqueIds) {
          const isBringer = userId === newBringerId;
          const isReceiver = userId === newReceiverId;

          let message = "";
          if (isBringer && isReceiver) {
            message = "조끼를 가져오고 가져가주세요!";
          } else if (isBringer) {
            message = "조끼를 가져와주세요!";
          } else {
            message = "조끼를 가져가주세요!";
          }

          await sendPushToUsers([userId], {
            title: "조끼 담당",
            body: `${message} ${dateStr}`,
            url: `/training/${id}`,
          });
        }
      }
    } catch {
      // 푸시 실패해도 수정은 성공
    }

    revalidatePath("/my/training-events");
    revalidatePath("/");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("팀 운동 수정 오류:", error);
    return NextResponse.json({ error: "수정에 실패했습니다" }, { status: 500 });
  }
}

// 팀 운동 삭제 (ADMIN)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.trainingEvent.delete({ where: { id } });
    revalidatePath("/my/training-events");
    revalidatePath("/");
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("팀 운동 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
