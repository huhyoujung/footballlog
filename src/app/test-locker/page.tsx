"use client";

import { useState } from "react";
import BackButton from "@/components/BackButton";
import PolaroidDateGroup from "@/components/PolaroidDateGroup";
import type { TrainingLog } from "@/types/training";

// 가짜 쪽지 데이터
interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  createdAt: string;
  recipient: {
    id: string;
    name: string | null;
  };
}

export default function TestLockerPage() {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // 가짜 운동일지 데이터 (MVP 포함)
  const fakeLogs: TrainingLog[] = [
    // 오늘 - MVP 받음
    {
      id: "log1",
      condition: "GREAT",
      what: "오늘 경기에서 2골 넣었어요! 팀워크가 정말 좋았습니다.",
      improvement: "다음엔 수비 위치 선정을 더 신경써야겠어요",
      imageUrl: null,
      title: "주말 경기",
      trainingEventId: "event1",
      trainingDate: new Date().toISOString().split('T')[0], // 오늘
      createdAt: new Date().toISOString(),
      user: {
        id: "user1",
        name: "김철수",
        image: null,
        position: "FW",
        number: 10,
      },
      _count: {
        comments: 3,
        likes: 12,
      },
      isLiked: false,
      isMvp: true, // MVP!
    },
    {
      id: "log2",
      condition: "GOOD",
      what: "패스 연습 집중적으로 했어요",
      improvement: "슈팅 정확도 높이기",
      imageUrl: null,
      title: "주말 경기",
      trainingEventId: "event1",
      trainingDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      user: {
        id: "user2",
        name: "이영희",
        image: null,
        position: "MF",
        number: 7,
      },
      _count: {
        comments: 1,
        likes: 5,
      },
      isLiked: false,
    },
    // 어제
    {
      id: "log3",
      condition: "TIRED",
      what: "체력 훈련 위주로 진행",
      improvement: "회복 시간 필요",
      imageUrl: null,
      title: "평일 훈련",
      trainingEventId: "event2",
      trainingDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // 어제
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      user: {
        id: "user1",
        name: "김철수",
        image: null,
        position: "FW",
        number: 10,
      },
      _count: {
        comments: 0,
        likes: 3,
      },
      isLiked: false,
    },
  ];

  // 가짜 쪽지 데이터
  const fakeNotes: LockerNote[] = [
    {
      id: "note1",
      content: "오늘 골 넣은 거 최고였어! 👏",
      color: "#FFF59D", // 노랑
      rotation: -8,
      positionX: 0,
      positionY: 0,
      tags: ["공격", "슛"],
      createdAt: new Date().toISOString(),
      recipient: { id: "user1", name: "김철수" },
    },
    {
      id: "note2",
      content: "패스 진짜 정확했어요 ⚽",
      color: "#F8BBD0", // 핑크
      rotation: 5,
      positionX: 0,
      positionY: 0,
      tags: ["패스", "팀워크"],
      createdAt: new Date().toISOString(),
      recipient: { id: "user1", name: "김철수" },
    },
    {
      id: "note3",
      content: "수비도 잘하고 만능이네 💪",
      color: "#B2DFDB", // 민트
      rotation: -3,
      positionX: 0,
      positionY: 0,
      tags: ["수비", "체력"],
      createdAt: new Date().toISOString(),
      recipient: { id: "user1", name: "김철수" },
    },
  ];

  // 날짜별 그룹핑
  const groupedLogs = [
    {
      date: new Date().toISOString().split('T')[0],
      displayDate: "오늘",
      logs: fakeLogs.filter(log => log.trainingDate === new Date().toISOString().split('T')[0]),
    },
    {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      displayDate: "어제",
      logs: fakeLogs.filter(log => log.trainingDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]),
    },
  ];

  // 날짜별 쪽지 매핑 (오늘 것만)
  const getNotesByDate = (date: string) => {
    if (date === new Date().toISOString().split('T')[0]) {
      return fakeNotes;
    }
    return [];
  };

  const handleExpand = (date: string, logs: TrainingLog[]) => {
    if (logs.length === 1) {
      // 실제 앱에서는 router.push 하지만 테스트에서는 그냥 확장
      setExpandedDate(date);
      return;
    }
    setExpandedDate(date);
  };

  const handleCollapse = () => {
    setExpandedDate(null);
  };

  const handleLikeToggle = (logId: string) => {
    console.log("Like toggled:", logId);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 뒤로가기 버튼 */}
      <div className="fixed top-4 left-4 z-30">
        <BackButton href="/" />
      </div>

      {/* 테스트 헤더 */}
      <div className="pt-16 pb-4 text-center">
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 mx-4 mb-4">
          <p className="text-sm font-semibold text-yellow-800">🧪 테스트 화면</p>
          <p className="text-xs text-yellow-700">쪽지 + 폴라로이드 + MVP 트로피</p>
        </div>
      </div>

      {/* 이름표 */}
      <div className="pb-4 flex justify-center">
        <div
          className="relative p-2 rounded"
          style={{
            background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #9CA3AF 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          <div className="bg-white px-6 py-3">
            <div className="flex items-center justify-center gap-2">
              <div className="text-xs text-gray-500 font-medium">No. 10</div>
              <div className="text-base font-semibold text-gray-900">김철수</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto">
        <div className="bg-white min-h-screen">
          {/* 폴라로이드 스택 (날짜별) */}
          <div className="flex flex-col items-center gap-6 py-6 px-4">
            {groupedLogs.map((group) => {
              const isThisExpanded = expandedDate === group.displayDate;
              const notesForDate = getNotesByDate(group.date);

              return (
                <div key={group.displayDate}>
                  <PolaroidDateGroup
                    logs={group.logs}
                    date={group.date}
                    displayDate={group.displayDate}
                    isExpanded={isThisExpanded}
                    onExpand={() => handleExpand(group.displayDate, group.logs)}
                    onCollapse={handleCollapse}
                    onLikeToggle={handleLikeToggle}
                    notes={notesForDate}
                    hideCount={true}
                  />
                </div>
              );
            })}
          </div>

          {/* 설명 */}
          <div className="p-4 mx-4 mb-8 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">테스트 항목</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ MVP 트로피 (오늘 폴라로이드 왼쪽 위)</li>
              <li>✅ 쪽지 3개 (오늘 폴라로이드 오른쪽)</li>
              <li>✅ 오늘 운동일지 2개</li>
              <li>✅ 어제 운동일지 1개</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
