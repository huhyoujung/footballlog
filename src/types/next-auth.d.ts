import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: Role;
      teamId?: string | null;
      team?: {
        id: string;
        name: string;
        inviteCode: string;
        primaryColor?: string;
      } | null;
    };
  }

  interface User {
    role?: Role;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    teamId?: string | null;
    team?: {
      id: string;
      name: string;
      inviteCode: string;
      primaryColor?: string;
    } | null;
  }
}
