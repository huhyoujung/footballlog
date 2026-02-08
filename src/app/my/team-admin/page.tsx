"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BackButton from "@/components/BackButton";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function TeamAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || !session) {
    return <LoadingSpinner />;
  }

  if (session.user.role !== "ADMIN") {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-lg font-semibold text-gray-900">팀 정보 수정</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
          <Link
            href="/my/team-settings"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-900">팀 프로필</span>
              <span className="text-xs text-gray-400">팀 이름, 로고 등</span>
            </div>
            <span className="text-gray-400">&rsaquo;</span>
          </Link>

          <Link
            href="/my/team-admin/admins"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-900">운영진 관리</span>
              <span className="text-xs text-gray-400">운영진 지정/해제</span>
            </div>
            <span className="text-gray-400">&rsaquo;</span>
          </Link>

          <Link
            href="/my/team-admin/vest"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-900">조끼 빨래 당번</span>
              <span className="text-xs text-gray-400">당번 순서 관리</span>
            </div>
            <span className="text-gray-400">&rsaquo;</span>
          </Link>

          <Link
            href="/my/team-equipment"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-900">장비 관리</span>
              <span className="text-xs text-gray-400">팀 장비 목록</span>
            </div>
            <span className="text-gray-400">&rsaquo;</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
