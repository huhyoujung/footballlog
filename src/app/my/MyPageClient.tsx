// OURPAGE - 클라이언트 컴포넌트 (팀원 목록, 닦달, 메뉴)
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import Link from "next/link";
import MyPageSkeleton from "@/components/MyPageSkeleton";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import TeamMemberList from "@/components/TeamMemberList";
import { useToast } from "@/lib/useToast";
import { useTeam } from "@/contexts/TeamContext";
import { withEulReul } from "@/lib/korean";
import { useAnalytics } from "@/lib/useAnalytics";

interface Team {
  id: string;
  name: string;
  inviteCode: string;
  members: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
    position: string | null;
    number: number | null;
    attendanceRate: number;
  }[];
}

interface MyPageClientProps {
  userId: string;
  isAdmin: boolean;
}

export default function MyPageClient({ userId, isAdmin }: MyPageClientProps) {
  const { teamData, loading: teamLoading } = useTeam();
  const { toast, showToast, hideToast } = useToast();
  const { capture } = useAnalytics();
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string | null;
    phoneNumber: string | null;
  } | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNudge = async (recipientId: string, recipientName: string) => {
    const message = nudgeMessage.trim();

    // 모달 닫기 및 메시지 초기화
    setSelectedMember(null);
    setNudgeMessage("");

    // Optimistic UI: 즉시 완료 상태로 변경
    setNudgedToday((prev) => new Set(prev).add(recipientId));

    // 즉시 토스트 표시
    showToast(`${withEulReul(recipientName)} 닦달했습니다! 👉`);

    // 백그라운드에서 API 호출
    fetch("/api/nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, message }),
    })
      .then(async (res) => {
        if (res.ok) {
          capture("nudge_sent", { recipient_id: recipientId });
        } else {
          // 실패 시 롤백
          setNudgedToday((prev) => {
            const next = new Set(prev);
            next.delete(recipientId);
            return next;
          });
          const data = await res.json();
          showToast(data.error || "닦달에 실패했습니다");
        }
      })
      .catch(() => {
        // 실패 시 롤백
        setNudgedToday((prev) => {
          const next = new Set(prev);
          next.delete(recipientId);
          return next;
        });
        showToast("닦달에 실패했습니다");
      });
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  // 로딩 상태: TeamContext만 체크 (profile은 fallback 있음)
  if (teamLoading) {
    return <MyPageSkeleton />;
  }

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col">
        <PageHeader title="OURPAGE" left={<BackButton href="/" />} sticky={false} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-4 w-full space-y-4">
        {/* 카드 메뉴 */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/my/training-events"
            prefetch={true}
            className="flex flex-col justify-between bg-team-50 rounded-2xl p-5 h-[140px] active:scale-[0.98] transition-transform touch-manipulation"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-team-600">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            <div>
              <p className="text-[17px] font-semibold text-gray-800">팀 운동</p>
              <p className="text-xs text-gray-500 mt-0.5">예정 · 지난 운동 보기</p>
            </div>
          </Link>
          <Link
            href={`/locker/${userId}`}
            prefetch={true}
            className="flex flex-col justify-between bg-team-50 rounded-2xl p-5 h-[140px] active:scale-[0.98] transition-transform touch-manipulation"
          >
            <svg width="28" height="28" viewBox="22 27 56 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-team-600">
              <rect x="25" y="30" width="50" height="40" strokeLinejoin="round"/>
              <line x1="41.6" y1="30" x2="41.6" y2="70" />
              <line x1="58.3" y1="30" x2="58.3" y2="70" />
              <g strokeWidth="1.2"><path d="M30 35h10 M30 38h10 M30 41h10"/><path d="M46.6 35h10 M46.6 38h10 M46.6 41h10"/><path d="M63.3 35h10 M63.3 38h10 M63.3 41h10"/></g>
              <g strokeWidth="1.2"><path d="M30 59h10 M30 62h10 M30 65h10"/><path d="M46.6 59h10 M46.6 62h10 M46.6 65h10"/><path d="M63.3 59h10 M63.3 62h10 M63.3 65h10"/></g>
              <rect x="36" y="48" width="2" height="6" fill="currentColor" stroke="none"/><rect x="52.6" y="48" width="2" height="6" fill="currentColor" stroke="none"/><rect x="69.3" y="48" width="2" height="6" fill="currentColor" stroke="none"/>
              <line x1="30" y1="70" x2="30" y2="74" /><line x1="70" y1="70" x2="70" y2="74" />
            </svg>
            <div>
              <p className="text-[17px] font-semibold text-gray-800">내 락커</p>
              <p className="text-xs text-gray-500 mt-0.5">프로필 · 일지 · 설정</p>
            </div>
          </Link>
        </div>

        {/* 팀원 목록 */}
        {teamData && (
          <TeamMemberList
            members={teamData.members}
            currentUserId={userId}
            onMemberClick={(member) => {
              setSelectedMember({
                id: member.id,
                name: member.name,
                phoneNumber: member.phoneNumber ?? null,
              });
            }}
            showSelfBadge={true}
            headerAction={isAdmin ? (
              <Link
                href="/my/team-admin"
                prefetch={true}
                className="flex items-center gap-1 text-gray-400 active:text-gray-600 transition-colors touch-manipulation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-xs">관리</span>
              </Link>
            ) : undefined}
          />
        )}

        {/* 피드백 배너 */}
        <Link
          href="/my/feedback"
          className="block bg-team-50 border border-team-200 rounded-2xl p-5 hover:bg-team-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-team-500 font-semibold text-sm mb-1">
                💌 피드백 보내기
              </h3>
              <p className="text-team-500 text-xs">
                피드백으로 더 유용하고 즐거운 락커룸을 만들어주세요
              </p>
            </div>
            <span className="text-team-500 text-2xl">&rsaquo;</span>
          </div>
        </Link>
      </main>

        {/* 문의하기 및 버전 */}
        <footer className="py-6 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              로그아웃
            </button>
            <span className="text-xs text-gray-300">|</span>
            <p className="text-xs text-gray-400">v0.1.0</p>
            <span className="text-xs text-gray-300">|</span>
            <a
              href="https://open.kakao.com/o/sqBLurfi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              문의하기
            </a>
          </div>
        </footer>
      </div>

      {/* 팀원 바텀시트 */}
      {mounted && selectedMember && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => {
              setSelectedMember(null);
              setNudgeMessage("");
            }}
            className="fixed inset-0 bg-black/50 z-50"
          />
          {/* Bottom Sheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up"
          >
            <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-6">
              {/* 핸들바 */}
              <div className="flex items-center justify-center mb-5 mt-1">
                <div className="flex-1 flex justify-start">
                  {selectedMember.phoneNumber ? (
                    <a
                      href={`tel:${selectedMember.phoneNumber}`}
                      className="flex items-center justify-center w-11 h-11 -m-1.5 text-team-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.54 5.54l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                  ) : (
                    <div className="flex items-center justify-center w-11 h-11 -m-1.5 text-gray-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.54 5.54l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                <div className="flex-1" />
              </div>

              {/* 헤더 */}
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {selectedMember.name} 닦달하기
                </h3>
                <p className="text-xs text-gray-400">
                  한 사람에게 하루에 한 번만 닦달할 수 있어요
                </p>
              </div>

              {/* 메시지 입력 - 닦달 가능할 때만 표시 */}
              {!nudgedToday.has(selectedMember.id) && (
                <div className="mb-5">
                  <div className="relative">
                    <textarea
                      value={nudgeMessage}
                      onChange={(e) => {
                        if (e.target.value.length <= 50) {
                          setNudgeMessage(e.target.value);
                        }
                      }}
                      placeholder="닦달 메시지를 입력하세요 (선택)"
                      rows={2}
                      maxLength={50}
                      className="w-full p-3 pb-7 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-team-500 transition-colors"
                    />
                    <div className={`absolute bottom-2 right-3 text-[11px] ${nudgeMessage.length >= 50 ? "text-red-500" : "text-gray-400"}`}>
                      {nudgeMessage.length}/50
                    </div>
                  </div>
                </div>
              )}

              {/* 닦달하기 버튼 - Primary */}
              <button
                onClick={() => handleNudge(selectedMember.id, selectedMember.name || '팀원')}
                disabled={nudgedToday.has(selectedMember.id)}
                className={`w-full py-3.5 rounded-[14px] font-semibold transition-[background-color,transform,opacity] flex items-center justify-center gap-2 ${
                  nudgedToday.has(selectedMember.id)
                    ? "bg-gray-50 text-gray-400 cursor-not-allowed border-2 border-gray-200"
                    : "bg-team-500 text-white hover:bg-team-600 active:scale-[0.98]"
                }`}
              >
                {nudgedToday.has(selectedMember.id) ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    오늘 닦달 완료
                  </>
                ) : (
                  <>
                    <span className="text-xl">👉</span>
                    닦달하기
                  </>
                )}
              </button>

              {/* 보조 버튼들 - 오터치 방지를 위해 Primary와 충분한 간격 */}
              <div className="flex gap-2.5 mt-6">
                <Link
                  href={`/locker/${selectedMember.id}`}
                  onClick={() => {
                    setSelectedMember(null);
                    setNudgeMessage("");
                  }}
                  className="flex-1 py-2.5 bg-team-50 text-team-600 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  🗃️ 락커 보기
                </Link>
                <Link
                  href={`/locker/${selectedMember.id}?openNote=true`}
                  onClick={() => {
                    setSelectedMember(null);
                    setNudgeMessage("");
                  }}
                  className="flex-1 py-2.5 bg-team-50 text-team-600 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  💌 칭찬 쪽지 놓고 오기
                </Link>
              </div>
            </div>
          </div>
        </>,
        document.getElementById('modal-root')!
      )}

      {/* 토스트 */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </>
  );
}
