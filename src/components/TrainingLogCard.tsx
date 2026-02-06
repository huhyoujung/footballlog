"use client";

import Link from "next/link";
import Image from "next/image";
import ConditionBadge from "./ConditionBadge";

interface TrainingLog {
  id: string;
  trainingDate: string;
  condition: number;
  conditionReason: string;
  keyPoints: string;
  improvement: string;
  imageUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  };
  _count: {
    comments: number;
    likes: number;
  };
  isLiked: boolean;
}

interface Props {
  log: TrainingLog;
  onLikeToggle: (logId: string) => void;
}

export default function TrainingLogCard({ log, onLikeToggle }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  return (
    <article className="bg-white p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
          {log.user.image ? (
            <Image
              src={log.user.image}
              alt={log.user.name || ""}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              👤
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-gray-900">
              {log.user.name || "익명"}
            </p>
            {(log.user.position || log.user.number != null) && (
              <span className="text-xs text-gray-400">
                {[log.user.position, log.user.number != null ? `#${log.user.number}` : null].filter(Boolean).join(" ")}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(log.trainingDate)} 운동
          </p>
        </div>
      </div>

      {/* 컨디션 */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <ConditionBadge condition={log.condition} />
          <p className="text-sm text-gray-600 flex-1">{log.conditionReason}</p>
        </div>
      </div>

      {/* 이미지 */}
      {log.imageUrl && (
        <Link href={`/log/${log.id}`} className="block mb-4">
          <img
            src={log.imageUrl}
            alt="운동 사진"
            className="w-full rounded-lg object-cover max-h-60"
          />
        </Link>
      )}

      {/* 내용 */}
      <Link href={`/log/${log.id}`}>
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-team-600 mb-1">
              📌 핵심 포인트
            </h3>
            <p className="text-gray-800 line-clamp-2">{log.keyPoints}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-700 mb-1">
              💪 더 잘하려면
            </h3>
            <p className="text-gray-800 line-clamp-2">{log.improvement}</p>
          </div>
        </div>
      </Link>

      {/* 액션 바 */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => onLikeToggle(log.id)}
          className={`flex items-center gap-1 text-sm ${
            log.isLiked ? "text-red-500" : "text-gray-500"
          }`}
        >
          <span>{log.isLiked ? "❤️" : "🤍"}</span>
          <span>{log._count.likes}</span>
        </button>
        <Link
          href={`/log/${log.id}`}
          className="flex items-center gap-1 text-sm text-gray-500"
        >
          <span>💬</span>
          <span>{log._count.comments}</span>
        </Link>
      </div>
    </article>
  );
}
