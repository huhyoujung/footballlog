"use client";

import Link from "next/link";
import { useViewTransitionRouter } from "@/hooks/useViewTransitionRouter";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
}

export default function BackButton({ href, onClick }: BackButtonProps) {
  const { back, push } = useViewTransitionRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    } else if (!href) {
      e.preventDefault();
      back();
    } else {
      e.preventDefault();
      push(href);
    }
  };

  // 더 큰 터치 영역 제공 (모바일 최적화 - 최소 48x48px)
  const className = "text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 active:scale-95 min-w-[44px] h-10 inline-flex items-center justify-center touch-manipulation rounded-lg transition-[background-color,color,transform]";

  const content = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className={className}>
      {content}
    </button>
  );
}
