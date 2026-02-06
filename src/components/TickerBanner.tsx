"use client";

import { useState, useEffect } from "react";

interface TickerMessage {
  key: string;
  text: string;
}

interface Props {
  messages: TickerMessage[];
}

export default function TickerBanner({ messages }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsAnimating(false);
      }, 500);
    }, 4000);

    return () => clearInterval(interval);
  }, [messages.length]);

  if (messages.length === 0) return null;

  const current = messages[currentIndex % messages.length];

  return (
    <div className="bg-team-50 border-b border-team-100 overflow-hidden h-10">
      <div className="max-w-lg mx-auto px-5 h-full flex items-center">
        <p
          key={current.key}
          className={`text-xs text-team-700 truncate transition-all duration-500 ease-in-out ${
            isAnimating
              ? "-translate-y-full opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          {current.text}
        </p>
      </div>
    </div>
  );
}
