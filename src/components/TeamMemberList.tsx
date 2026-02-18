"use client";

import Image from "next/image";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  position?: string | null;
  number?: number | null;
  attendanceRate?: number;
}

interface Props {
  members: TeamMember[];
  currentUserId?: string;
  onMemberClick: (member: TeamMember) => void;
  showSelfBadge?: boolean; // "나" 뱃지 표시 여부
  headerAction?: React.ReactNode;
}

export default function TeamMemberList({
  members,
  currentUserId,
  onMemberClick,
  showSelfBadge = true,
  headerAction,
}: Props) {
  return (
    <div className="bg-white rounded-xl py-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-800">
          우리 팀원 <span className="text-gray-400 font-normal">{members.length}명</span>
        </h2>
        {headerAction}
      </div>
      <div className="space-y-2 px-4">
        {members.map((member) => {
          const isCurrentUser = member.id === currentUserId;
          const isClickable = !isCurrentUser;

          return (
            <button
              key={member.id}
              onClick={() => {
                if (isClickable) {
                  onMemberClick(member);
                }
              }}
              disabled={!isClickable}
              className={`flex items-center gap-3 py-1.5 w-full -mx-2 px-2 text-left ${
                isClickable
                  ? "cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                  : ""
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {member.image ? (
                  <Image
                    src={member.image}
                    alt={member.name || ""}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-team-50" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* 이름 */}
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-900">
                    {member.name || "익명"}
                  </span>
                  {/* 운영진 */}
                  {member.role === "ADMIN" && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-team-300 flex-shrink-0"
                    >
                      <path
                        d="M12 6L16 12L21 8L19 18H5L3 8L8 12L12 6Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {/* 포지션/등번호 */}
                {(member.position || member.number) && (
                  <span className="text-xs text-gray-500">
                    {member.position || ""}
                    {member.number ? ` ${member.number}` : ""}
                  </span>
                )}

                {/* 출석률 */}
                {member.attendanceRate !== undefined && (
                  <span className="text-xs text-gray-500">
                    {member.attendanceRate}%
                  </span>
                )}

                {/* 뱃지 (나) */}
                {showSelfBadge && (
                  <div className="flex items-center gap-1 ml-auto">
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full">
                        나
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
