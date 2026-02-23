import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      // JWT에서 읽기만 함 — DB 쿼리 없음 (매 요청마다 DB hit 제거)
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as "ADMIN" | "MEMBER") ?? "MEMBER";
        session.user.teamId = (token.teamId as string | null) ?? null;
        session.user.team = (token.team as typeof session.user.team) ?? null;
      }
      return session;
    },
    async jwt({ token, user, trigger }) {
      // 로그인 최초 1회 또는 update() 호출 시에만 DB 조회
      if (user || trigger === "update") {
        const userId = (user?.id ?? token.sub) as string;
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            role: true,
            teamId: true,
            team: { select: { id: true, name: true, inviteCode: true, primaryColor: true } },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.teamId = dbUser.teamId;
          token.team = dbUser.team;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
};
