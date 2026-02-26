/**
 * 2026-02-23 NUTTY FC 라인업 시딩 스크립트
 * 이벤트: cmlt6usvl000bl804uav6xfbr
 *
 * 사용법: npx ts-node scripts/seed-lineup.ts
 *
 * ⚠️  주의: 망곰, 이린은 DB 매칭 실패 → 스크립트 실행 전 아래 TODO를 채워주세요.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVENT_ID = "cmlt6usvl000bl804uav6xfbr";

// 이름 → userId 매핑
const NAME_TO_ID: Record<string, string> = {
  짱선: "cmldejk660000ld04vis8ymgt",
  유정: "cmla7uxmm0000e6dbpaq4dcaw",
  채원: "cmlejnwh30000ld04rbbeap9t",
  영현: "cmlei65t40000ky04sq75wizc",
  유진: "cmldfdzno0000jp04jd35zi8w",
  서형: "cmledzy400000l504saxijqgu",
  은진: "cmlciqfrd0000l4044e4ilhbb",
  지수: "cmlck9r5n0000ks04r3617z4c",
  구지: "cmlcxo2te0000l104wl1m8soz",
  민서: "cmlh9000g0000jq0434f8yx2m",
  지현: "cmlef4wn90000ky04xk6whhws",
  아라: "cmlczyrhe0004ky047ea15qyx",
  하은: "cmld3kpa70000jr045qpr0ebg",
  수빈: "cmledsosr0000l204v6beaj9r",
  순영: "cmlclyou80002i904dggcnsj4",
  효선: "cmlegj69n0005ky04qstxh64h",
  서영: "cmleee55o0002le04jiuy5k1j",
  도현: "cmleslamg0000ld04zkecp9ct",
  예림: "cmlee0zoh0004l504vaej2q19",
  유빈: "cmld4llcb0000l404yzkvcxvs",
  선영: "cmllkhlvi0000jl047gyvti9n",
  혜원: "cmlfxmlmz0002jy04b53gtflb",
  정지: "cmlg0kuvm0006l8047ifpe1hd",
  최지: "cmltgijku0000la045s6i5dpm", // Jiyeon Choi (최지연)
  망곰: "cmli59fuw0000kw04cdh3zme9", // 황수연
  이린: "cmlfx9z1g0002kz04h9b5vtgw", // Caitlin Ann Brown
};

// 세션 ID (1Q~4Q 기존, 5Q 신규 생성)
const SESSION_IDS: Record<string, string> = {
  "1Q": "cmlxgzpel0007e64ovj9pduq0",
  "2Q": "cmlxgzpel0008e64ojhgw1g61",
  "3Q": "cmlxgzpel0009e64o8aemiox5",
  "4Q": "cmlxgzpel000ae64ogxv0yrtu",
  // 5Q: 스크립트 실행 시 자동 생성됨
};

// 각 세션별 출전 선수 (없는 이름은 스킵됨)
const LINEUP: Record<string, string[]> = {
  "1Q": ["짱선", "유정", "채원", "최지", "영현", "유진", "서형", "은진", "지수", "구지"],
  "2Q": ["민서", "지현", "아라", "하은", "망곰", "수빈", "순영", "효선", "서영", "도현"],
  "3Q": ["이린", "선영", "유빈", "유정", "정지", "혜원", "예림", "효선", "지수", "도현"],
  "4Q": ["구지", "채원", "아라", "영현", "유진", "수빈", "은진", "지수", "효선", "짱선"],
  "5Q": ["민서", "서형", "최지", "하은", "혜원", "망곰", "은진", "서영", "지현", "순영"],
};

async function main() {
  console.log("🏃 라인업 시딩 시작...\n");

  // 1. 5Q 세션 생성 (없으면)
  let session5Q = await prisma.trainingSession.findFirst({
    where: { trainingEventId: EVENT_ID, title: "5Q" },
  });

  if (!session5Q) {
    session5Q = await prisma.trainingSession.create({
      data: {
        trainingEventId: EVENT_ID,
        title: "5Q",
        memo: "15분",
        orderIndex: 4,
        sessionType: "LINEUP",
        requiresTeams: false,
      },
    });
    console.log(`✅ 5Q 세션 생성: ${session5Q.id}`);
  } else {
    console.log(`ℹ️  5Q 세션 이미 존재: ${session5Q.id}`);
  }
  SESSION_IDS["5Q"] = session5Q.id;

  // 2. 기존 배정 모두 삭제 (멱등성)
  const sessionIds = Object.values(SESSION_IDS);
  const deleted = await prisma.sessionTeamAssignment.deleteMany({
    where: { trainingSessionId: { in: sessionIds } },
  });
  if (deleted.count > 0) console.log(`🗑️  기존 배정 ${deleted.count}건 삭제\n`);

  // 3. 각 세션에 선수 배정
  let totalInserted = 0;
  const skipped: string[] = [];

  for (const [quarter, players] of Object.entries(LINEUP)) {
    const sessionId = SESSION_IDS[quarter];
    const assignments: { trainingSessionId: string; userId: string; teamLabel: string }[] = [];

    for (const name of players) {
      const userId = NAME_TO_ID[name];
      if (!userId) {
        skipped.push(`${quarter}: ${name}`);
        continue;
      }
      assignments.push({ trainingSessionId: sessionId, userId, teamLabel: "A" });
    }

    if (assignments.length > 0) {
      await prisma.sessionTeamAssignment.createMany({
        data: assignments,
        skipDuplicates: true,
      });
      console.log(`✅ ${quarter} (${sessionId}): ${assignments.length}명 배정`);
      totalInserted += assignments.length;
    }
  }

  console.log(`\n🎉 완료! 총 ${totalInserted}건 배정`);

  if (skipped.length > 0) {
    console.log(`\n⚠️  매칭 실패 (NAME_TO_ID에 추가 필요):`);
    skipped.forEach((s) => console.log(`  - ${s}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
