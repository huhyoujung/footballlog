"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
}

export default function BackButton({ href, onClick }: BackButtonProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    } else if (!href) {
      e.preventDefault();
      setIsNavigating(true);
      router.back();
    } else {
      // Link 클릭 시에도 로딩 표시
      setIsNavigating(true);
    }
  };

  const className = "text-gray-500 hover:text-gray-700 p-3 -ml-3 inline-flex items-center justify-center min-w-[44px] min-h-[44px]";

  const content = isNavigating ? (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
  ) : (
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
