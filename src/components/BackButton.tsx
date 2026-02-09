"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
}

export default function BackButton({ href, onClick }: BackButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    } else if (!href) {
      e.preventDefault();
      router.back();
    }
  };

  // 더 큰 터치 영역 제공 (모바일 최적화)
  const className = "text-gray-500 hover:text-gray-700 p-2 inline-flex items-center justify-center touch-manipulation";

  const content = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
