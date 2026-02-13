import { ImageResponse } from "@vercel/og";
import { prisma } from "@/lib/prisma";

export const runtime = "edge";
export const alt = "팀 운동";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  // 팀 운동 정보 가져오기
  const event = await prisma.trainingEvent.findUnique({
    where: { id: eventId },
    include: {
      team: { select: { name: true, logoUrl: true, primaryColor: true } },
      rsvps: { select: { id: true } },
    },
  });

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const timeStr = new Date(event.date).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const rsvpCount = event.rsvps.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #967B5D 0%, #685643 100%)",
          padding: "60px",
        }}
      >
        {/* 메인 카드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: "1000px",
            background: "white",
            borderRadius: "24px",
            padding: "60px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* 헤더 - 팀 정보 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "40px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {/* 팀 로고 또는 축구공 아이콘 */}
              {event.team.logoUrl ? (
                <img
                  src={event.team.logoUrl}
                  width={60}
                  height={60}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "#967B5D",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                  }}
                >
                  ⚽
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#967B5D",
                  }}
                >
                  {event.team.name}
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    color: "#9CA3AF",
                  }}
                >
                  라커룸
                </div>
              </div>
            </div>
            {/* 응답 인원 */}
            {rsvpCount > 0 && (
              <div
                style={{
                  fontSize: "20px",
                  color: "#6B7280",
                  background: "#F3F4F6",
                  padding: "8px 20px",
                  borderRadius: "12px",
                  fontWeight: "500",
                }}
              >
                {rsvpCount}명 응답
              </div>
            )}
          </div>

          {/* 운동 제목 */}
          <div
            style={{
              fontSize: "56px",
              fontWeight: "bold",
              color: "#111827",
              marginBottom: "30px",
              lineHeight: 1.2,
            }}
          >
            {event.title}
          </div>

          {/* 정보들 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* 날짜/시간 */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  fontSize: "28px",
                }}
              >
                📅
              </div>
              <div
                style={{
                  fontSize: "28px",
                  color: "#4B5563",
                  fontWeight: "500",
                }}
              >
                {dateStr} {timeStr}
              </div>
            </div>

            {/* 장소 */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  fontSize: "28px",
                }}
              >
                📍
              </div>
              <div
                style={{
                  fontSize: "28px",
                  color: "#4B5563",
                  fontWeight: "500",
                }}
              >
                {event.location}
              </div>
            </div>

            {/* 유니폼 */}
            {event.uniform && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    fontSize: "28px",
                  }}
                >
                  👕
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    color: "#4B5563",
                    fontWeight: "500",
                  }}
                >
                  {event.uniform}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div
            style={{
              display: "flex",
              marginTop: "40px",
              paddingTop: "30px",
              borderTop: "2px solid #F3F4F6",
            }}
          >
            <div
              style={{
                fontSize: "20px",
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
