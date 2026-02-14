"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import TeamMemberList from "@/components/TeamMemberList";
import { useToast } from "@/lib/useToast";
import { useTeam } from "@/contexts/TeamContext";
import { withEulReul } from "@/lib/korean";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";

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

interface ProfileData {
  image: string | null;
}

export default function MyPage() {
  const { data: session, update } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const { toast, showToast, hideToast } = useToast();
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

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
        if (!res.ok) {
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

  // SWR로 profile 데이터 페칭 (자동 캐싱)
  const { data: profileData, isLoading: profileLoading } = useSWR<ProfileData>(
    session?.user?.teamId ? "/api/profile" : null,
    fetcher,
    {
      fallbackData: { image: session?.user?.image || null },
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 30000, // 30초 캐시 (마이페이지는 자주 변경)
      keepPreviousData: true,
    }
  );

  const userImage = profileData?.image || session?.user?.image || null;

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  // 로딩 상태: TeamContext만 체크 (profile은 fallback 있음)
  if (teamLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
            <BackButton href="/" />
            <h1 className="text-base font-semibold text-gray-900">OURPAGE</h1>
            <div className="w-[44px]"></div>
          </div>
        </header>

      <main className="flex-1 max-w-2xl mx-auto px-4 py-4 w-full space-y-4">
        {teamData && (
          <>
            {/* 메뉴 */}
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
              <Link
                href="/my/training-events"
                prefetch={true}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">팀 운동</span>
                <span className="text-gray-300">&rsaquo;</span>
              </Link>
              <Link
                href={`/locker/${session?.user?.id}`}
                prefetch={true}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">내 락커</span>
                <span className="text-gray-300">&rsaquo;</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/my/team-admin"
                  prefetch={true}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="text-gray-900">팀 관리</span>
                  <span className="text-gray-300">&rsaquo;</span>
                </Link>
              )}
            </div>

            {/* 팀원 목록 */}
            <TeamMemberList
              members={teamData.members}
              currentUserId={session?.user?.id}
              onMemberClick={(member) => {
                setSelectedMember({
                  id: member.id,
                  name: member.name,
                });
              }}
              showSelfBadge={true}
            />
          </>
        )}

        {/* 피드백 배너 */}
        <Link
          href="/my/feedback"
          className="mx-4 mb-4 block bg-team-100 border border-team-200 rounded-xl p-4 hover:bg-team-200 transition-all"
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

      {/* 팀원 모달 */}
      {mounted && selectedMember && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => {
              setSelectedMember(null);
              setNudgeMessage("");
            }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 50
            }}
          />
          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              width: '90%',
              maxWidth: '24rem'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'white',
                borderRadius: '1rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
              }}
            >
              {/* 헤더 */}
              <div style={{ padding: '1.5rem 1.5rem 0.5rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                  {selectedMember.name} 닦달하기
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  한 사람에게 하루에 한 번만 닦달할 수 있어요
                </p>
              </div>

              {/* 메시지 입력 - 닦달 가능할 때만 표시 */}
              {!nudgedToday.has(selectedMember.id) && (
                <div style={{ padding: '0 1rem 1rem' }}>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      value={nudgeMessage}
                      onChange={(e) => {
                        if (e.target.value.length <= 50) {
                          setNudgeMessage(e.target.value);
                        }
                      }}
                      placeholder="닦달 메시지를 입력하세요... (선택)"
                      rows={2}
                      maxLength={50}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        paddingBottom: '2rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        fontSize: '0.875rem',
                        resize: 'none',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#967B5D';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      right: '0.75rem',
                      fontSize: '0.75rem',
                      color: nudgeMessage.length >= 50 ? '#ef4444' : '#9ca3af'
                    }}>
                      {nudgeMessage.length}/50
                    </div>
                  </div>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* 닦달하기 버튼 - Primary */}
                <button
                  onClick={() => handleNudge(selectedMember.id, selectedMember.name || '팀원')}
                  disabled={nudgedToday.has(selectedMember.id)}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
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
                      <span style={{ fontSize: '1.25rem' }}>👉</span>
                      닦달하기
                    </>
                  )}
                </button>

                {/* 락커 보기 버튼 - Secondary */}
                <Link
                  href={`/locker/${selectedMember.id}`}
                  onClick={() => {
                    setSelectedMember(null);
                    setNudgeMessage("");
                  }}
                  className="w-full py-2 px-4 bg-white border-2 border-team-500 text-team-600 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-1.5 hover:bg-team-50 active:scale-[0.98]"
                >
                  🗃️ 락커 보기
                </Link>

                {/* 칭찬하기 버튼 - Secondary */}
                <Link
                  href={`/locker/${selectedMember.id}?openNote=true`}
                  onClick={() => {
                    setSelectedMember(null);
                    setNudgeMessage("");
                  }}
                  className="w-full py-2 px-4 bg-white border-2 border-team-500 text-team-600 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-1.5 hover:bg-team-50 active:scale-[0.98]"
                >
                  💌 칭찬하기
                </Link>
              </div>

              {/* 취소 버튼 */}
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setNudgeMessage("");
                }}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  borderTop: '1px solid #f3f4f6',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                닫기
              </button>
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
