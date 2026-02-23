import { ReactNode } from "react";

interface PageHeaderProps {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
  className?: string;
}

/**
 * 공통 페이지 헤더 — 높이 h-10 (40px) 고정.
 * 모든 페이지에서 이 컴포넌트를 사용하여 헤더 높이를 통일합니다.
 * title은 absolute 중앙 정렬이므로 left/right 너비에 영향받지 않습니다.
 */
export default function PageHeader({ title, left, right, sticky = true, className = "" }: PageHeaderProps) {
  return (
    <header className={`bg-white border-b border-gray-200 ${sticky ? "sticky top-0 z-30" : ""} ${className}`.trim()}>
      <div className="max-w-2xl mx-auto px-4 h-10 flex items-center justify-between relative">
        <div className="z-[1] flex items-center shrink-0">{left ?? <div className="w-10" />}</div>
        {title && (
          <h1 className="absolute inset-0 flex items-center justify-center text-base font-semibold text-gray-900 pointer-events-none">
            {title}
          </h1>
        )}
        <div className="z-[1] flex items-center shrink-0">{right ?? <div className="w-10" />}</div>
      </div>
    </header>
  );
}
