"use client";

import { useState, useEffect } from "react";

export default function TestModalPage() {
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string;
    position?: string | null;
    number?: number | null;
  } | null>(null);

  useEffect(() => {
    console.log('selectedMember changed:', selectedMember);
  }, [selectedMember]);

  const testMembers = [
    { id: "1", name: "김철수", position: "FW", number: 10 },
    { id: "2", name: "이영희", position: "MF", number: 7 },
    { id: "3", name: "박민수", position: "DF", number: 4 },
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">모달 테스트</h1>
          <p className="text-gray-600 mb-8">팀원을 클릭하면 모달이 나타납니다</p>

          <div className="bg-white rounded-xl p-6 space-y-4">
            {testMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  console.log('Button clicked:', member.name);
                  setSelectedMember(member);
                }}
                className="w-full p-4 bg-team-50 hover:bg-team-100 rounded-lg text-left transition-colors"
              >
                <div className="font-medium">{member.name}</div>
                <div className="text-sm text-gray-600">
                  {member.position} · #{member.number}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 팀원 액션 모달 */}
      {selectedMember && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            overflow: 'auto'
          }}
          onClick={() => setSelectedMember(null)}
        >
          <div
            style={{
              position: 'relative',
              zIndex: 10000
            }}
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 pt-5 pb-4 text-center">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedMember.name}
              </h3>
              {selectedMember.position && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedMember.position} {selectedMember.number !== null && `· #${selectedMember.number}`}
                </p>
              )}
            </div>

            {/* 액션 버튼들 */}
            <div className="p-4 space-y-2">
              {/* 닦달하기 버튼 */}
              <button
                onClick={() => {
                  alert(`${selectedMember.name}을(를) 닦달했습니다!`);
                  setSelectedMember(null);
                }}
                className="w-full py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 bg-team-500 text-white hover:bg-team-600 active:scale-[0.98]"
              >
                <span className="text-xl">👉</span>
                닦달하기
              </button>

              {/* 칭찬하기 버튼 (곧 지원) */}
              <button
                disabled
                className="w-full py-3.5 px-4 rounded-xl font-medium bg-gray-50 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 10v12" />
                  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                </svg>
                칭찬하기 (곧 지원)
              </button>
            </div>

            {/* 취소 버튼 */}
            <button
              onClick={() => setSelectedMember(null)}
              className="w-full py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
