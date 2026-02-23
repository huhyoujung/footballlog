import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const alt = "도전장";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const event = await prisma.trainingEvent.findUnique({
    where: { challengeToken: token },
    select: {
      date: true,
      location: true,
      opponentTeamName: true,
      team: {
        select: { name: true, logoUrl: true, primaryColor: true },
      },
      opponentTeam: {
        select: { name: true, logoUrl: true, primaryColor: true },
      },
    },
  });

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const teamColor = event.team.primaryColor || "#1D4237";

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = new Date(event.date).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}BB 100%)`,
          padding: "48px",
        }}
      >
        {/* 메인 카드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: "1040px",
            background: "white",
            borderRadius: "28px",
            padding: "56px 64px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}
        >
          {/* 도전장 뱃지 */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: teamColor,
                background: teamColor + "18",
                padding: "8px 24px",
                borderRadius: "100px",
                letterSpacing: "0.08em",
              }}
            >
              ⚽  도전장
            </div>
          </div>

          {/* VS 레이아웃 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0px",
              marginBottom: "44px",
            }}
          >
            {/* 호스트팀 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                flex: 1,
              }}
            >
              {event.team.logoUrl ? (
                <img
                  src={event.team.logoUrl}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "4px solid white",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: teamColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "52px",
                    fontWeight: "bold",
                    color: "white",
                    border: "4px solid white",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}
                >
                  {event.team.name[0]}
                </div>
              )}
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                {event.team.name}
              </div>
            </div>

            {/* VS */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "120px",
                fontSize: "48px",
                fontWeight: "900",
                color: "#E5E7EB",
                letterSpacing: "-0.02em",
              }}
            >
              VS
            </div>

            {/* 상대팀 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                flex: 1,
              }}
            >
              {event.opponentTeam?.logoUrl ? (
                <img
                  src={event.opponentTeam.logoUrl}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "4px solid white",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}
                />
              ) : event.opponentTeam ? (
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: event.opponentTeam.primaryColor || "#6B7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "52px",
                    fontWeight: "bold",
                    color: "white",
                    border: "4px solid white",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  }}
                >
                  {event.opponentTeam.name[0]}
                </div>
              ) : (
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "52px",
                    border: "4px dashed #D1D5DB",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  }}
                >
                  ?
                </div>
              )}
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: (event.opponentTeam || event.opponentTeamName) ? "700" : "600",
                  color: (event.opponentTeam || event.opponentTeamName) ? "#111827" : "#9CA3AF",
                  textAlign: "center",
                }}
              >
                {event.opponentTeam?.name ?? event.opponentTeamName ?? "상대팀"}
              </div>
            </div>
          </div>

          {/* 경기 정보 */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              borderTop: "2px solid #F3F4F6",
              paddingTop: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "22px",
                color: "#4B5563",
                fontWeight: "500",
              }}
            >
              <span>📅</span>
              <span>{`${dateStr} ${timeStr}`}</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "22px",
                color: "#4B5563",
                fontWeight: "500",
              }}
            >
              <span>📍</span>
              <span>{event.location}</span>
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                fontSize: "18px",
                color: "#9CA3AF",
              }}
            >
              ⚽️ 필드 밖에서도 이어지는 우리의 이야기
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
