import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : ["error"],
  });

// 개발 환경에서 느린 쿼리 로그 (200ms 이상)
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: any) => {
    if (e.duration > 200) {
      console.log(`🐌 Slow query (${e.duration}ms):`, e.query);
    }
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
