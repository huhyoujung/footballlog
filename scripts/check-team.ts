import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTeam() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "gjdbwjd805@gmail.com" },
      include: { team: true },
    });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("👤 User:", user.name);
    console.log("📧 Email:", user.email);
    console.log("\n🏆 Team Info:");
    console.log("  Name:", user.team?.name);
    console.log("  Logo URL:", user.team?.logoUrl || "(없음)");
    console.log("  Primary Color:", user.team?.primaryColor);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeam();
