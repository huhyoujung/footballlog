import { prisma } from "../src/lib/prisma";

async function main() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      primaryColor: true,
    },
  });

  console.log("=== 팀 컬러 현황 ===\n");
  teams.forEach((team) => {
    console.log(`팀명: ${team.name}`);
    console.log(`컬러: ${team.primaryColor}`);
    console.log("---");
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
