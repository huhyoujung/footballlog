"use client";

import Image from "next/image";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
  role: string;
}

interface Props {
  members: TeamMember[];
  activeUserIds: string[];
}

export default function TeamMemberStrip({ members, activeUserIds }: Props) {
  if (members.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-lg mx-auto">
        <div className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-hide">
          {members.map((member) => {
            const isActive = activeUserIds.includes(member.id);
            return (
              <div
                key={member.id}
                className="flex flex-col items-center min-w-[64px]"
              >
                <div
                  className={`w-14 h-14 rounded-full overflow-hidden mb-1.5 ${
                    isActive
                      ? "ring-2 ring-team-500 ring-offset-2"
                      : "ring-1 ring-gray-200"
                  }`}
                >
                  {member.image ? (
                    <Image
                      src={member.image}
                      alt={member.name || ""}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg">
                      👤
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-900 font-medium truncate max-w-[64px]">
                  {member.name || "익명"}
                </span>
                {(member.position || member.number !== null) && (
                  <span className="text-[10px] text-gray-400">
                    {member.position}
                    {member.position && member.number !== null && " "}
                    {member.number !== null && member.number}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
