// 팀 관리 메뉴 클라이언트 컴포넌트
"use client";

import Link from "next/link";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

export default function TeamAdminClient() {
  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <PageHeader title="팀 관리" left={<BackButton href="/my" />} />

      <main className="max-w-2xl mx-auto px-4 py-4">
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
              <span className="text-xs text-gray-400">팀 장비 및 관리자 관리</span>
            </div>
            <span className="text-gray-400">&rsaquo;</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
