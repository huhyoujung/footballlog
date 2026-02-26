/**
 * 라인업 포지션 배치 스크립트 (1-3-3-3 포메이션)
 * 이미지 명단 순서 기준: GK → 수비 3명 → 미드 3명 → 공격 3명
 *
 * 사용법: npx tsx scripts/seed-positions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 1-3-3-3 포메이션 좌표 (x: 0-1 좌→우, y: 0-1 위→아래, 필드 하단=우리 골대)
const FORMATION_SLOTS: { x: number; y: number }[] = [
  { x: 0.50, y: 0.80 }, // 0: GK
  { x: 0.22, y: 0.65 }, // 1: CB-L
  { x: 0.50, y: 0.67 }, // 2: CB-C
  { x: 0.78, y: 0.65 }, // 3: CB-R
  { x: 0.20, y: 0.46 }, // 4: MF-L
  { x: 0.50, y: 0.44 }, // 5: MF-C
  { x: 0.80, y: 0.46 }, // 6: MF-R
  { x: 0.25, y: 0.24 }, // 7: FW-L
  { x: 0.50, y: 0.20 }, // 8: FW-C
  { x: 0.75, y: 0.24 }, // 9: FW-R
];

// 세션별 선수 ID (이미지 명단 순서 유지 → 포메이션 슬롯 0-9 매핑)
const SESSION_LINEUPS: Record<string, string[]> = {
  cmlxgzpel0007e64ovj9pduq0: [ // 1Q
    "cmldejk660000ld04vis8ymgt", // 짱선   → GK
    "cmla7uxmm0000e6dbpaq4dcaw", // 유정   → CB-L
    "cmlejnwh30000ld04rbbeap9t", // 채원   → CB-C
    "cmltgijku0000la045s6i5dpm", // 최지   → CB-R
    "cmlei65t40000ky04sq75wizc", // 영현   → MF-L
    "cmldfdzno0000jp04jd35zi8w", // 유진   → MF-C
    "cmledzy400000l504saxijqgu", // 서형   → MF-R
    "cmlciqfrd0000l4044e4ilhbb", // 은진   → FW-L
    "cmlck9r5n0000ks04r3617z4c", // 지수   → FW-C
    "cmlcxo2te0000l104wl1m8soz", // 구지   → FW-R
  ],
  cmlxgzpel0008e64ojhgw1g61: [ // 2Q
    "cmlh9000g0000jq0434f8yx2m", // 민서   → GK
    "cmlef4wn90000ky04xk6whhws", // 지현   → CB-L
    "cmlczyrhe0004ky047ea15qyx", // 아라   → CB-C
    "cmld3kpa70000jr045qpr0ebg", // 하은   → CB-R
    "cmli59fuw0000kw04cdh3zme9", // 망곰   → MF-L
    "cmledsosr0000l204v6beaj9r", // 수빈   → MF-C
    "cmlclyou80002i904dggcnsj4", // 순영   → MF-R
    "cmlegj69n0005ky04qstxh64h", // 효선   → FW-L
    "cmleee55o0002le04jiuy5k1j", // 서영   → FW-C
    "cmleslamg0000ld04zkecp9ct", // 도현   → FW-R
  ],
  cmlxgzpel0009e64o8aemiox5: [ // 3Q
    "cmlfx9z1g0002kz04h9b5vtgw", // 이린   → GK
    "cmllkhlvi0000jl047gyvti9n", // 선영   → CB-L
    "cmld4llcb0000l404yzkvcxvs", // 유빈   → CB-C
    "cmla7uxmm0000e6dbpaq4dcaw", // 유정   → CB-R
    "cmlg0kuvm0006l8047ifpe1hd", // 정지   → MF-L
    "cmlfxmlmz0002jy04b53gtflb", // 혜원   → MF-C
    "cmlee0zoh0004l504vaej2q19", // 예림   → MF-R
    "cmlegj69n0005ky04qstxh64h", // 효선   → FW-L
    "cmlck9r5n0000ks04r3617z4c", // 지수   → FW-C
    "cmleslamg0000ld04zkecp9ct", // 도현   → FW-R
  ],
  cmlxgzpel000ae64ogxv0yrtu: [ // 4Q
    "cmlcxo2te0000l104wl1m8soz", // 구지   → GK
    "cmlejnwh30000ld04rbbeap9t", // 채원   → CB-L
    "cmlczyrhe0004ky047ea15qyx", // 아라   → CB-C
    "cmlei65t40000ky04sq75wizc", // 영현   → CB-R
    "cmldfdzno0000jp04jd35zi8w", // 유진   → MF-L
    "cmledsosr0000l204v6beaj9r", // 수빈   → MF-C
    "cmlciqfrd0000l4044e4ilhbb", // 은진   → MF-R
    "cmlck9r5n0000ks04r3617z4c", // 지수   → FW-L
    "cmlegj69n0005ky04qstxh64h", // 효선   → FW-C
    "cmldejk660000ld04vis8ymgt", // 짱선   → FW-R
  ],
};

// 5Q는 세션 ID를 DB에서 조회
async function main() {
  console.log("🏟️  포지션 배치 시작 (1-3-3-3 포메이션)...\n");

  // 5Q 세션 ID 조회
  const session5Q = await prisma.trainingSession.findFirst({
    where: { trainingEventId: "cmlt6usvl000bl804uav6xfbr", title: "5Q" },
    select: { id: true },
  });

  if (session5Q) {
    SESSION_LINEUPS[session5Q.id] = [
      "cmlh9000g0000jq0434f8yx2m", // 민서   → GK
      "cmledzy400000l504saxijqgu", // 서형   → CB-L
      "cmltgijku0000la045s6i5dpm", // 최지   → CB-C
      "cmld3kpa70000jr045qpr0ebg", // 하은   → CB-R
      "cmlfxmlmz0002jy04b53gtflb", // 혜원   → MF-L
      "cmli59fuw0000kw04cdh3zme9", // 망곰   → MF-C
      "cmlciqfrd0000l4044e4ilhbb", // 은진   → MF-R
      "cmleee55o0002le04jiuy5k1j", // 서영   → FW-L
      "cmlef4wn90000ky04xk6whhws", // 지현   → FW-C
      "cmlclyou80002i904dggcnsj4", // 순영   → FW-R
    ];
  }

  for (const [sessionId, playerIds] of Object.entries(SESSION_LINEUPS)) {
    const positions: Record<string, { x: number; y: number }> = {};
    playerIds.forEach((userId, idx) => {
      if (idx < FORMATION_SLOTS.length) {
        positions[userId] = FORMATION_SLOTS[idx];
      }
    });

    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { positions, sessionType: "LINEUP" },
    });

    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { title: true },
    });
    console.log(`✅ ${session?.title ?? sessionId}: ${Object.keys(positions).length}명 배치`);
  }

  console.log("\n🎉 포지션 배치 완료!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
