<!-- 친선경기 시스템 기능 명세서 -->

# 친선경기

> 팀 간 친선경기 매칭, 룰 합의, 심판 배정, 실시간 득점 기록 및 선수 교체를 관리하는 시스템

## 개요

친선경기 시스템은 두 팀 간의 경기를 처음부터 끝까지 관리한다. 호스트팀이 매칭을 요청하면 상대팀이 수락/거절하고, 양팀이 경기 룰(쿼터 수, 시간, 백패스/오프사이드 허용 여부 등)에 합의한다. 심판 배정 후 경기가 진행되면 체크인한 참가자 누구나 실시간으로 득점과 선수 교체를 기록할 수 있다. 매칭 상태는 `DRAFT` -> `PENDING` -> `CONFIRMED` -> `RULES_PENDING` -> `RULES_CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED` 순으로 전이되며, 언제든 `CANCELLED`로 전환 가능하다. 취소 시 팀 운동으로 전환하는 옵션도 제공한다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 7-1 | 매칭 & 경기 규칙 | 매칭 요청/수락/거절/취소, 룰 합의, 상태 전이 |
| 7-2 | 심판/득점/교체 | 쿼터별 심판 배정, 실시간 득점, 선수 교체 기록 |

## 관련 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/app/api/match-pairing/route.ts` | 매칭 요청 생성 |
| `src/app/api/match-pairing/[id]/accept/route.ts` | 매칭 수락 |
| `src/app/api/match-pairing/[id]/reject/route.ts` | 매칭 거절 |
| `src/app/api/match-pairing/[id]/cancel/route.ts` | 경기 취소 / 팀 운동 전환 |
| `src/app/api/match-rules/route.ts` | 경기 룰 생성/수정/조회 |
| `src/app/api/referee-assignment/route.ts` | 심판 배정 생성/수정/조회 |
| `src/app/api/match-score/route.ts` | 득점 기록 생성/조회 |
| `src/app/api/player-substitution/route.ts` | 선수 교체 기록 생성/조회 |
| `src/lib/match-helpers.ts` | 점수 재계산 및 이벤트 업데이트 헬퍼 |
| `prisma/schema.prisma` | 데이터 모델 정의 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/match-pairing` | 친선경기 매칭 요청 (호스트팀 -> 상대팀) |
| POST | `/api/match-pairing/[id]/accept` | 매칭 수락 (상대팀) |
| POST | `/api/match-pairing/[id]/reject` | 매칭 거절 (상대팀) |
| POST | `/api/match-pairing/[id]/cancel` | 경기 취소 또는 팀 운동 전환 |
| GET | `/api/match-rules?trainingEventId=xxx` | 경기 룰 조회 |
| POST | `/api/match-rules` | 경기 룰 생성/수정 |
| GET | `/api/referee-assignment?trainingEventId=xxx` | 심판 배정 조회 |
| POST | `/api/referee-assignment` | 심판 배정 생성/수정 |
| GET | `/api/match-score?trainingEventId=xxx` | 득점 기록 조회 |
| POST | `/api/match-score` | 득점 기록 생성 |
| GET | `/api/player-substitution?trainingEventId=xxx` | 선수 교체 기록 조회 |
| POST | `/api/player-substitution` | 선수 교체 기록 생성 |

## 주요 코드

### 7-1. 매칭 & 경기 규칙

#### 1. 매칭 요청 생성 (`src/app/api/match-pairing/route.ts`)

호스트팀의 `TrainingEvent`를 기반으로 상대팀에 대응하는 이벤트를 자동 생성하고, 양쪽 이벤트를 `linkedEventId`로 연결한다.

```ts
// src/app/api/match-pairing/route.ts

// POST /api/match-pairing - 친선경기 매칭 요청
export async function POST(request: NextRequest) {
  // ...인증/권한 확인...

  const { trainingEventId, opponentTeamId } = await request.json();

  // 호스트 팀의 TrainingEvent 조회
  const hostEvent = await prisma.trainingEvent.findUnique({
    where: { id: trainingEventId },
    include: { team: true },
  });

  if (!hostEvent) {
    return NextResponse.json({ error: 'Training event not found' }, { status: 404 });
  }

  if (!hostEvent.isFriendlyMatch) {
    return NextResponse.json({ error: 'Not a friendly match' }, { status: 400 });
  }

  // 이미 매칭 요청이 진행 중인지 확인
  if (hostEvent.matchStatus !== 'DRAFT') {
    return NextResponse.json({ error: '이미 매칭 요청이 진행 중입니다' }, { status: 400 });
  }

  // 자기 팀과 매칭하려는지 확인
  if (opponentTeamId === user.teamId) {
    return NextResponse.json({ error: '자기 팀과는 매칭할 수 없습니다' }, { status: 400 });
  }

  // 상대팀에 대응하는 TrainingEvent 생성
  const opponentEvent = await prisma.trainingEvent.create({
    data: {
      teamId: opponentTeamId,
      createdById: user.id,
      title: `${hostEvent.team.name}과(와)의 친선경기`,
      isRegular: false,
      isFriendlyMatch: true,
      enablePomVoting: hostEvent.enablePomVoting,
      date: hostEvent.date,
      location: hostEvent.location,
      venueId: hostEvent.venueId,
      shoes: hostEvent.shoes,
      uniform: hostEvent.uniform,
      notes: `${hostEvent.team.name} 팀으로부터 친선경기 요청`,
      rsvpDeadline: hostEvent.rsvpDeadline,
      rsvpDeadlineOffset: hostEvent.rsvpDeadlineOffset,
      minimumPlayers: hostEvent.minimumPlayers,
      opponentTeamId: user.teamId,
      matchStatus: 'PENDING',
    },
  });

  // 호스트 이벤트 업데이트 (링크 연결)
  await prisma.trainingEvent.update({
    where: { id: trainingEventId },
    data: {
      linkedEventId: opponentEvent.id,
      opponentTeamId: opponentTeamId,
      matchStatus: 'PENDING',
    },
  });

  return NextResponse.json({
    hostEvent: hostEvent,
    opponentEvent: opponentEvent,
    message: 'Match pairing request sent',
  });
}
```

#### 2. 매칭 수락 (`src/app/api/match-pairing/[id]/accept/route.ts`)

상대팀이 수락하면 양쪽 이벤트를 트랜잭션으로 `CONFIRMED` 상태로 업데이트한다.

```ts
// src/app/api/match-pairing/[id]/accept/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...인증/권한 확인...

  const opponentEvent = await prisma.trainingEvent.findUnique({
    where: { id: id },
    include: { linkedEvent: true },
  });

  if (opponentEvent.matchStatus !== 'PENDING') {
    return NextResponse.json({ error: 'Match is not pending' }, { status: 400 });
  }

  // 양쪽 이벤트 모두 CONFIRMED로 업데이트
  await prisma.$transaction([
    prisma.trainingEvent.update({
      where: { id: id },
      data: { matchStatus: 'CONFIRMED' },
    }),
    prisma.trainingEvent.update({
      where: { id: opponentEvent.linkedEvent.id },
      data: { matchStatus: 'CONFIRMED' },
    }),
  ]);

  return NextResponse.json({
    message: 'Match confirmed',
    id,
    linkedEventId: opponentEvent.linkedEvent.id,
  });
}
```

#### 3. 매칭 거절 (`src/app/api/match-pairing/[id]/reject/route.ts`)

거절 시 상대팀 이벤트를 삭제하고 호스트 이벤트를 `DRAFT` 상태로 되돌린다.

```ts
// src/app/api/match-pairing/[id]/reject/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...인증/권한 확인...

  const hostEventId = opponentEvent.linkedEvent.id;

  // 양쪽 이벤트 모두 삭제 (거절 시)
  await prisma.$transaction([
    prisma.trainingEvent.delete({
      where: { id: id },
    }),
    prisma.trainingEvent.update({
      where: { id: hostEventId },
      data: {
        linkedEventId: null,
        opponentTeamId: null,
        matchStatus: 'DRAFT',
      },
    }),
  ]);

  return NextResponse.json({
    message: 'Match rejected',
    hostEventId,
  });
}
```

#### 4. 경기 취소 (`src/app/api/match-pairing/[id]/cancel/route.ts`)

취소 시 팀 운동으로 전환하거나 양쪽 모두 취소 처리할 수 있다.

```ts
// src/app/api/match-pairing/[id]/cancel/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...인증/권한 확인...

  const { reason, convertToTraining } = await request.json();

  // 취소 처리
  if (convertToTraining) {
    // 팀 운동으로 전환
    await prisma.trainingEvent.update({
      where: { id: id },
      data: {
        isFriendlyMatch: false,
        linkedEventId: null,
        opponentTeamId: null,
        matchStatus: 'DRAFT',
        convertedFromMatch: true,
      },
    });

    // 상대팀 이벤트 삭제
    if (event.linkedEventId) {
      await prisma.trainingEvent.delete({
        where: { id: event.linkedEventId },
      });
    }

    return NextResponse.json({
      message: 'Converted to regular training',
      id,
    });
  } else {
    // 친선경기 취소 (양쪽 모두 취소 상태로 변경)
    const updates = [
      prisma.trainingEvent.update({
        where: { id: id },
        data: {
          matchStatus: 'CANCELLED',
          cancelled: true,
          cancellationReason: reason || 'OTHER',
        },
      }),
    ];

    if (event.linkedEventId) {
      updates.push(
        prisma.trainingEvent.update({
          where: { id: event.linkedEventId },
          data: {
            matchStatus: 'CANCELLED',
            cancelled: true,
            cancellationReason: reason || 'OTHER',
          },
        })
      );
    }

    await prisma.$transaction(updates);

    return NextResponse.json({
      message: 'Match cancelled',
      id,
      linkedEventId: event.linkedEventId,
    });
  }
}
```

#### 5. 경기 룰 생성/수정 (`src/app/api/match-rules/route.ts`)

호스트팀 또는 상대팀이 룰을 제안/수정할 수 있으며, 수정 시 양팀 합의 상태가 리셋된다.

```ts
// src/app/api/match-rules/route.ts

export async function POST(request: NextRequest) {
  // ...인증/권한 확인...

  const {
    trainingEventId,
    template,
    quarterCount,
    quarterMinutes,
    quarterBreak,
    halftime,
    playersPerSide,
    allowBackpass,
    allowOffside,
  } = await request.json();

  const event = await prisma.trainingEvent.findUnique({
    where: { id: trainingEventId },
    include: { linkedEvent: true },
  });

  // 호스트팀 또는 상대팀인지 확인
  const isHostTeam = event.teamId === user.teamId;
  const isOpponentTeam = event.linkedEvent?.teamId === user.teamId;

  if (!isHostTeam && !isOpponentTeam) {
    return NextResponse.json({ error: 'Not authorized for this match' }, { status: 403 });
  }

  const existingRules = await prisma.matchRules.findUnique({
    where: { trainingEventId: event.id },
  });

  if (existingRules) {
    // 기존 룰 업데이트 (합의 상태 리셋)
    const updatedRules = await prisma.matchRules.update({
      where: { trainingEventId: event.id },
      data: {
        template,
        quarterCount,
        quarterMinutes,
        quarterBreak,
        halftime,
        playersPerSide,
        allowBackpass,
        allowOffside,
        // 수정하면 양팀 합의 리셋
        agreedByTeamA: isHostTeam,
        agreedByTeamB: isOpponentTeam,
      },
    });

    return NextResponse.json(updatedRules);
  } else {
    // 새 룰 생성
    const newRules = await prisma.matchRules.create({
      data: {
        trainingEventId: event.id,
        template,
        quarterCount,
        quarterMinutes,
        quarterBreak,
        halftime,
        playersPerSide,
        allowBackpass,
        allowOffside,
        agreedByTeamA: isHostTeam,
        agreedByTeamB: isOpponentTeam,
      },
    });

    // 양쪽 TrainingEvent 상태 업데이트
    await prisma.trainingEvent.update({
      where: { id: event.id },
      data: { matchStatus: 'RULES_PENDING' },
    });

    if (event.linkedEventId) {
      await prisma.trainingEvent.update({
        where: { id: event.linkedEventId },
        data: { matchStatus: 'RULES_PENDING' },
      });
    }

    return NextResponse.json(newRules);
  }
}
```

### 7-2. 심판/득점/교체

#### 6. 심판 배정 (`src/app/api/referee-assignment/route.ts`)

쿼터별로 심판을 배정하며, 수정 시 기존 배정을 삭제 후 재생성하고 합의 상태를 리셋한다.

```ts
// src/app/api/referee-assignment/route.ts

export async function POST(request: NextRequest) {
  // ...인증/권한 확인...

  const { trainingEventId, referees } = await request.json();
  // referees: [{ quarter: 1, userId: 'xxx', teamSide: 'TEAM_A' }, ...]

  const existingAssignment = await prisma.refereeAssignment.findUnique({
    where: { trainingEventId: event.id },
    include: { quarterReferees: true },
  });

  if (existingAssignment) {
    // 기존 쿼터 심판 삭제 후 새로 생성
    await prisma.quarterReferee.deleteMany({
      where: { assignmentId: existingAssignment.id },
    });

    const quarterReferees = referees.map((ref: any) => ({
      assignmentId: existingAssignment.id,
      quarter: ref.quarter,
      userId: ref.userId,
      teamSide: ref.teamSide,
    }));

    await prisma.quarterReferee.createMany({
      data: quarterReferees,
    });

    // 수정하면 합의 상태 리셋
    const updatedAssignment = await prisma.refereeAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        status: 'PENDING_APPROVAL',
        approvedByTeamA: isHostTeam,
        approvedByTeamB: isOpponentTeam,
      },
      include: { quarterReferees: true },
    });

    return NextResponse.json(updatedAssignment);
  } else {
    // 새 배정 생성
    const newAssignment = await prisma.refereeAssignment.create({
      data: {
        trainingEventId: event.id,
        status: 'DRAFT',
        approvedByTeamA: isHostTeam,
        approvedByTeamB: isOpponentTeam,
        quarterReferees: {
          create: referees.map((ref: any) => ({
            quarter: ref.quarter,
            userId: ref.userId,
            teamSide: ref.teamSide,
          })),
        },
      },
      include: { quarterReferees: true },
    });

    return NextResponse.json(newAssignment);
  }
}
```

#### 7. 득점 기록 (`src/app/api/match-score/route.ts`)

체크인한 참가자만 득점을 기록할 수 있으며, 기록 후 총점을 자동 재계산한다.

```ts
// src/app/api/match-score/route.ts

export async function POST(request: NextRequest) {
  // ...인증 확인...

  const {
    trainingEventId,
    quarter,
    scoringTeam,
    scorerId,
    assistId,
    minute,
    isOwnGoal,
  } = await request.json();

  // TrainingEvent 조회 (체크인 여부 확인)
  const event = await prisma.trainingEvent.findUnique({
    where: { id: trainingEventId },
    include: { checkIns: true },
  });

  // 체크인한 사람만 기록 가능
  const hasCheckedIn = event.checkIns.some((checkIn) => checkIn.userId === user.id);
  if (!hasCheckedIn) {
    return NextResponse.json({ error: 'Only checked-in members can record goals' }, { status: 403 });
  }

  // 득점 기록 생성
  const goalRecord = await prisma.goalRecord.create({
    data: {
      trainingEventId,
      quarter,
      scoringTeam,
      scorerId,
      assistId,
      recordedById: user.id,
      minute,
      isOwnGoal: isOwnGoal || false,
    },
    include: {
      scorer: { select: { id: true, name: true, image: true } },
      assistant: { select: { id: true, name: true, image: true } },
      recordedBy: { select: { id: true, name: true, image: true } },
    },
  });

  // 총점 재계산 및 업데이트
  await updateMatchScore(trainingEventId, event.linkedEventId);
  const { teamAScore, teamBScore } = await recalculateMatchScore(trainingEventId);

  return NextResponse.json({
    ...goalRecord,
    teamAScore,
    teamBScore,
  });
}
```

#### 8. 점수 재계산 헬퍼 (`src/lib/match-helpers.ts`)

자책골을 반대팀 득점으로 처리하는 로직이 포함된 점수 재계산 함수다.

```ts
// src/lib/match-helpers.ts

/**
 * 친선경기 점수 재계산
 * @param trainingEventId 운동 이벤트 ID
 * @returns 양팀 점수 { teamAScore, teamBScore }
 */
export async function recalculateMatchScore(trainingEventId: string) {
  // TEAM_A 득점 (자책골 제외)
  const teamAGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_A',
      isOwnGoal: false,
    },
  });

  // TEAM_B 득점 (자책골 제외)
  const teamBGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_B',
      isOwnGoal: false,
    },
  });

  // TEAM_A의 자책골 = TEAM_B 득점
  const teamAOwnGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_B', // TEAM_B가 득점했지만
      isOwnGoal: true,       // 자책골
    },
  });

  // TEAM_B의 자책골 = TEAM_A 득점
  const teamBOwnGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_A', // TEAM_A가 득점했지만
      isOwnGoal: true,       // 자책골
    },
  });

  return {
    teamAScore: teamAGoals + teamAOwnGoals,
    teamBScore: teamBGoals + teamBOwnGoals,
  };
}

/**
 * 친선경기 점수를 재계산하고 TrainingEvent 업데이트
 * @param trainingEventId 운동 이벤트 ID
 * @param linkedEventId 링크된 상대팀 이벤트 ID (옵션)
 */
export async function updateMatchScore(trainingEventId: string, linkedEventId?: string | null) {
  const { teamAScore, teamBScore } = await recalculateMatchScore(trainingEventId);

  // 현재 이벤트 업데이트
  await prisma.trainingEvent.update({
    where: { id: trainingEventId },
    data: { teamAScore, teamBScore },
  });

  // 링크된 상대팀 이벤트도 업데이트
  if (linkedEventId) {
    await prisma.trainingEvent.update({
      where: { id: linkedEventId },
      data: { teamAScore, teamBScore },
    });
  }
}
```

#### 9. 선수 교체 기록 (`src/app/api/player-substitution/route.ts`)

교체하는 두 선수 모두 체크인 상태여야 하며, 같은 선수를 교체하려는 시도는 차단된다.

```ts
// src/app/api/player-substitution/route.ts

export async function POST(request: NextRequest) {
  // ...인증 확인...

  const { trainingEventId, quarter, teamSide, playerOutId, playerInId, minute } = await request.json();

  if (!trainingEventId || !quarter || !teamSide || !playerOutId || !playerInId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 같은 선수가 in/out에 동시에 들어가지 않도록 검증
  if (playerOutId === playerInId) {
    return NextResponse.json({ error: '같은 선수를 교체할 수 없습니다' }, { status: 400 });
  }

  // 체크인 확인 (기록하는 사람이 체크인했는지)
  const checkIn = await prisma.checkIn.findUnique({
    where: {
      trainingEventId_userId: {
        trainingEventId,
        userId: user.id,
      },
    },
  });

  if (!checkIn) {
    return NextResponse.json({ error: 'Only checked-in members can record substitutions' }, { status: 403 });
  }

  // 교체되는 두 선수가 체크인했는지 확인
  const playersCheckIn = await prisma.checkIn.findMany({
    where: {
      trainingEventId,
      userId: { in: [playerOutId, playerInId] },
    },
  });

  if (playersCheckIn.length !== 2) {
    return NextResponse.json({ error: 'Both players must be checked in' }, { status: 400 });
  }

  // 교체 기록 생성
  const substitution = await prisma.playerSubstitution.create({
    data: {
      trainingEventId,
      quarter,
      teamSide,
      playerOutId,
      playerInId,
      recordedById: user.id,
      minute: minute || null,
    },
    include: {
      playerOut: { select: { id: true, name: true, image: true, position: true, number: true } },
      playerIn: { select: { id: true, name: true, image: true, position: true, number: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(substitution, { status: 201 });
}
```

## 비즈니스 규칙

### 매칭 관련

- **자기 팀 매칭 불가**: `opponentTeamId === user.teamId` 체크로 자기 팀과의 매칭을 차단
- **중복 매칭 요청 불가**: `matchStatus !== 'DRAFT'`이면 추가 매칭 요청 불가
- **친선경기 전용**: `isFriendlyMatch === true`인 이벤트만 매칭 가능
- **매칭 거절 시 복원**: 상대팀 이벤트를 삭제하고 호스트팀 이벤트를 `DRAFT`로 되돌림
- **매칭 수락 시 트랜잭션**: 양쪽 이벤트를 단일 트랜잭션으로 `CONFIRMED` 처리

### 상태 전이 (MatchStatus)

```
DRAFT ──[매칭 요청]──> PENDING ──[수락]──> CONFIRMED ──[룰 제안]──> RULES_PENDING
                          │                                              │
                          │[거절]                                        │[양팀 합의]
                          ▼                                              ▼
                     DRAFT (복원)                                  RULES_CONFIRMED
                                                                         │
                                                                    IN_PROGRESS
                                                                         │
                                                                     COMPLETED

어느 단계에서든 ──> CANCELLED
```

### 취소 옵션

- **팀 운동 전환** (`convertToTraining: true`): `isFriendlyMatch`를 `false`로 바꾸고 상대팀 이벤트 삭제, `convertedFromMatch: true` 플래그 설정
- **단순 취소**: 양쪽 이벤트에 `cancelled: true`, `matchStatus: 'CANCELLED'` 설정

### 취소 사유 (`CancellationReason`)

| 값 | 의미 |
|----|------|
| `INSUFFICIENT_PLAYERS` | 인원 부족 |
| `WEATHER` | 날씨 |
| `VENUE_UNAVAILABLE` | 장소 문제 |
| `OTHER` | 기타 |

### 룰 합의

- 룰을 제안한 팀만 자동 합의 (`agreedByTeamA: isHostTeam, agreedByTeamB: isOpponentTeam`)
- 룰 수정 시 양팀 합의 상태 리셋 (수정한 팀만 합의)
- 양팀 모두 합의해야 `RULES_CONFIRMED`로 전이

### 심판 배정

- 쿼터별 1명씩 배정 (`@@unique([assignmentId, quarter])`)
- 심판의 소속팀 기록 (`teamSide: TeamSide`)
- 수정 시 기존 배정 전체 삭제 후 재생성 (delete-and-recreate 패턴)
- 합의 상태: `DRAFT` -> `PENDING_APPROVAL` -> `CONFIRMED`

### 득점 기록

- **체크인 필수**: 체크인한 참가자만 득점 기록 가능
- **자책골 처리**: `isOwnGoal: true`이면 반대팀 득점으로 계산
- **자동 재계산**: 득점 기록 후 `updateMatchScore()`로 양쪽 이벤트의 `teamAScore`/`teamBScore` 자동 업데이트
- **어시스트 선택적**: `assistId`는 nullable

### 선수 교체

- **자기 교체 불가**: `playerOutId === playerInId` 차단
- **체크인 3중 검증**: 기록자, 나간 선수, 들어온 선수 모두 체크인 상태 확인
- **친선경기 전용**: `isFriendlyMatch === true` 확인
- **필수 필드**: `trainingEventId`, `quarter`, `teamSide`, `playerOutId`, `playerInId`

### 접근 제어

- 모든 API는 `getServerSession(authOptions)`으로 인증 확인
- 매칭 요청: 호스트팀 소속 확인 (`hostEvent.teamId !== user.teamId`)
- 매칭 수락/거절: 상대팀 소속 확인 (`opponentEvent.teamId !== user.teamId`)
- 룰/심판: 양쪽 팀 중 하나에 소속되어야 함 (`isHostTeam || isOpponentTeam`)
- 득점/교체 기록: 체크인한 참가자만 가능

## 데이터 모델

### 매칭 상태 enum

```prisma
// prisma/schema.prisma

enum MatchStatus {
  DRAFT           // 초안 (매칭 요청 전)
  PENDING         // 매칭 요청 중
  CONFIRMED       // 매칭 확정
  RULES_PENDING   // 룰 합의 중
  RULES_CONFIRMED // 룰 합의 완료
  IN_PROGRESS     // 경기 진행 중
  COMPLETED       // 경기 완료
  CANCELLED       // 취소됨
}

enum CancellationReason {
  INSUFFICIENT_PLAYERS  // 인원 부족
  WEATHER              // 날씨
  VENUE_UNAVAILABLE    // 장소 문제
  OTHER                // 기타
}

enum TeamSide {
  TEAM_A  // 호스트팀
  TEAM_B  // 상대팀
}

enum RuleTemplate {
  FUTSAL          // 풋살 기본 (4쿼터 x 12분, 백패스X, 오프사이드X)
  ELEVEN_HALVES   // 11인제 전후반 (2쿼터 x 45분, 백패스O, 오프사이드O)
  CUSTOM          // 커스텀 룰
}

enum AssignmentStatus {
  DRAFT             // 초안 (자동 배정)
  PENDING_APPROVAL  // 승인 대기 중
  CONFIRMED         // 양팀 합의 완료
}
```

### TrainingEvent (친선경기 관련 필드)

```prisma
// prisma/schema.prisma

model TrainingEvent {
  id                  String    @id @default(cuid())
  teamId              String
  createdById         String
  title               String
  // ...기본 필드...

  // === 친선경기 관련 필드 ===
  isFriendlyMatch     Boolean          @default(false)
  minimumPlayers      Int?             // 최소 인원
  rsvpDeadlineOffset  Int?             // RSVP 마감 오프셋 (예: -7, -5, -3, -1일 전)
  linkedEventId       String?          @unique // 상대팀 TrainingEvent ID
  opponentTeamId      String?          // 상대팀 ID
  matchStatus         MatchStatus      @default(DRAFT)
  cancelled           Boolean          @default(false)
  cancellationReason  CancellationReason?
  convertedFromMatch  Boolean          @default(false) // 친선경기에서 팀 운동으로 전환됨
  teamAScore          Int              @default(0)     // 우리팀 총점
  teamBScore          Int              @default(0)     // 상대팀 총점
  eloRatingChange     Float?           // ELO 레이팅 변화량

  // 친선경기 관계
  linkedEvent          TrainingEvent?        @relation("FriendlyPair", fields: [linkedEventId], references: [id], onDelete: SetNull)
  linkedByEvent        TrainingEvent?        @relation("FriendlyPair")
  opponentTeam         Team?                 @relation("OpponentTeam", fields: [opponentTeamId], references: [id], onDelete: SetNull)
  matchRules           MatchRules?
  refereeAssignment    RefereeAssignment?
  goalRecords          GoalRecord[]
  playerSubstitutions  PlayerSubstitution[]

  @@index([teamId, date(sort: Desc)])
  @@index([isFriendlyMatch, matchStatus])
}
```

### MatchRules (경기 룰)

```prisma
// prisma/schema.prisma

model MatchRules {
  id              String        @id @default(cuid())
  trainingEventId String        @unique
  template        RuleTemplate  @default(CUSTOM)
  quarterCount    Int           @default(4)
  quarterMinutes  Int           @default(12)
  quarterBreak    Int           @default(2)  // 쿼터 간 휴식 (분)
  halftime        Int           @default(5)  // 하프타임 휴식 (분, 2쿼터 후)
  playersPerSide  Int           @default(6)  // 한 팀당 인원
  allowBackpass   Boolean       @default(false)
  allowOffside    Boolean       @default(false)
  agreedByTeamA   Boolean       @default(false)
  agreedByTeamB   Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  trainingEvent TrainingEvent @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)

  @@index([trainingEventId])
}
```

### RefereeAssignment + QuarterReferee (심판 배정)

```prisma
// prisma/schema.prisma

model RefereeAssignment {
  id              String           @id @default(cuid())
  trainingEventId String           @unique
  status          AssignmentStatus @default(DRAFT)
  approvedByTeamA Boolean          @default(false)
  approvedByTeamB Boolean          @default(false)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  trainingEvent   TrainingEvent   @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)
  quarterReferees QuarterReferee[]

  @@index([trainingEventId])
}

model QuarterReferee {
  id           String    @id @default(cuid())
  assignmentId String
  quarter      Int       // 1, 2, 3, 4
  userId       String
  teamSide     TeamSide  // 심판이 속한 팀
  startedAt    DateTime?
  endedAt      DateTime?
  createdAt    DateTime  @default(now())

  assignment RefereeAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([assignmentId, quarter])
  @@index([assignmentId])
  @@index([userId])
}
```

### GoalRecord (득점 기록)

```prisma
// prisma/schema.prisma

model GoalRecord {
  id              String   @id @default(cuid())
  trainingEventId String
  quarter         Int      // 1, 2, 3, 4
  scoringTeam     TeamSide // 득점한 팀
  scorerId        String?  // 득점자 (nullable - 자책골 등)
  assistId        String?  // 도움 (nullable)
  recordedById    String   // 기록한 사람 (벤치 멤버)
  minute          Int?     // 득점 시간 (쿼터 내 분)
  isOwnGoal       Boolean  @default(false)
  createdAt       DateTime @default(now())

  trainingEvent TrainingEvent @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)
  scorer        User?         @relation("GoalScorer", fields: [scorerId], references: [id], onDelete: SetNull)
  assistant     User?         @relation("GoalAssistant", fields: [assistId], references: [id], onDelete: SetNull)
  recordedBy    User          @relation("GoalRecorder", fields: [recordedById], references: [id], onDelete: Cascade)

  @@index([trainingEventId, quarter])
}
```

### PlayerSubstitution (선수 교체)

```prisma
// prisma/schema.prisma

model PlayerSubstitution {
  id              String   @id @default(cuid())
  trainingEventId String
  quarter         Int      // 1, 2, 3, 4
  teamSide        TeamSide // 교체가 발생한 팀
  playerOutId     String   // 나간 선수
  playerInId      String   // 들어온 선수
  recordedById    String   // 기록한 사람 (체크인한 사람 누구나)
  minute          Int?     // 교체 시간 (쿼터 내 분)
  createdAt       DateTime @default(now())

  trainingEvent TrainingEvent @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)
  playerOut     User          @relation("PlayerOut", fields: [playerOutId], references: [id], onDelete: Cascade)
  playerIn      User          @relation("PlayerIn", fields: [playerInId], references: [id], onDelete: Cascade)
  recordedBy    User          @relation("SubstitutionRecorder", fields: [recordedById], references: [id], onDelete: Cascade)

  @@index([trainingEventId, quarter])
  @@index([playerOutId])
  @@index([playerInId])
}
```

## 프론트엔드

### 데이터 페칭 패턴

친선경기 관련 데이터는 각 API 엔드포인트의 GET 메서드를 통해 조회하며, `trainingEventId`를 쿼리 파라미터로 전달한다:

```
GET /api/match-rules?trainingEventId=xxx
GET /api/referee-assignment?trainingEventId=xxx
GET /api/match-score?trainingEventId=xxx
GET /api/player-substitution?trainingEventId=xxx
```

### 이벤트 연결 구조 (Linked Events)

양팀의 `TrainingEvent`는 `linkedEventId`로 1:1 연결되어 동일한 경기를 각 팀의 관점에서 관리한다:

```
[호스트팀 TrainingEvent]                [상대팀 TrainingEvent]
  id: "event-A"                           id: "event-B"
  linkedEventId: "event-B"  <--------->   (linkedByEvent relation)
  opponentTeamId: "team-B"               opponentTeamId: "team-A"
  matchStatus: CONFIRMED                 matchStatus: CONFIRMED
  teamAScore: 3                          teamAScore: 3
  teamBScore: 1                          teamBScore: 1
```

### 룰 템플릿 프리셋

| 템플릿 | 쿼터 수 | 쿼터 시간 | 백패스 | 오프사이드 | 설명 |
|--------|---------|----------|--------|-----------|------|
| `FUTSAL` | 4 | 12분 | 불가 | 없음 | 풋살 기본 룰 |
| `ELEVEN_HALVES` | 2 | 45분 | 허용 | 적용 | 11인제 전후반 |
| `CUSTOM` | 사용자 정의 | 사용자 정의 | 선택 | 선택 | 커스텀 룰 |

### 특이사항

- **양팀 합의 패턴**: 룰과 심판 배정 모두 "한쪽이 제안 -> 상대팀 합의" 방식으로, 수정 시 합의가 리셋되어 다시 합의를 받아야 함
- **점수 동기화**: 득점 기록은 하나의 이벤트에만 저장되지만, `updateMatchScore()`가 양쪽 이벤트의 `teamAScore`/`teamBScore`를 동기화
- **팀 운동 전환**: 친선경기가 취소되어도 장소/시간이 예약된 상태이므로, `convertToTraining` 옵션으로 일반 팀 운동으로 전환 가능 (`convertedFromMatch: true`로 이력 추적)
- **ELO 레이팅**: `eloRatingChange` 필드로 향후 팀 레이팅 시스템 확장 가능
