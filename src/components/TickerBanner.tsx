"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface TickerMessage {
  key: string;
  text: string;
  url?: string;
}

interface Props {
  messages: TickerMessage[];
}

export default function TickerBanner({ messages }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitial, setIsInitial] = useState(true);

  // Initial slide-in animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitial(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Message rotation
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsAnimating(false);
      }, 800);
    }, 8000);

    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) return null;

  const current = messages[currentIndex % messages.length];

  const handleClick = () => {
    if (current.url) {
      router.push(current.url);
    }
  };

  return (
    <div
      className={`overflow-hidden h-10 relative ${
        current.url ? "cursor-pointer" : ""
      }`}
      onClick={handleClick}
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.1), 0 1px 0 rgba(0,0,0,0.5)',
        borderTop: '1px solid #333',
        borderBottom: '1px solid #111',
      }}
    >
      {/* LED 도트 매트릭스 패턴 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--color-team-300) 6%, transparent) 0.5px, transparent 0.5px), radial-gradient(circle, rgba(255, 255, 255, 0.08) 0.8px, transparent 0.8px)`,
          backgroundSize: '3px 3px, 6px 6px',
          backgroundPosition: '0 0, 1.5px 1.5px',
        }}
      />

      {/* 스캔라인 효과 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(0deg, transparent 50%, rgba(0,0,0,0.3) 50%)',
          backgroundSize: '100% 2px',
        }}
      />

      {/* 상단 하이라이트 */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
        }}
      />

      {/* 하단 그림자 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-black/50"
      />

      <div className="max-w-2xl mx-auto px-4 h-full flex items-center relative z-10 overflow-hidden">
        <div
          key={current.key}
          style={{
            transition: 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className={`w-full ${
            isInitial
              ? "translate-x-full opacity-0"
              : isAnimating
                ? "-translate-x-full opacity-0"
                : "translate-x-0 opacity-100"
          }`}
        >
          <p
            className="text-xs font-semibold tracking-wide whitespace-nowrap ticker-text"
            style={{
              fontFamily: '"Umdot", monospace',
              color: '#ffffff',
              textShadow: `0 0 16px var(--color-team-500), 0 0 8px color-mix(in srgb, var(--color-team-500) 80%, transparent), 0 0 4px color-mix(in srgb, var(--color-team-500) 60%, transparent), 0 1px 2px rgba(0, 0, 0, 0.8)`,
              filter: 'brightness(1)',
              animation: current.text.length > 50 ? 'ticker-scroll 15s linear infinite' : 'none',
            }}
          >
            {current.text}
            {current.text.length > 50 && <span className="ml-16">{current.text}</span>}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .ticker-text:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
