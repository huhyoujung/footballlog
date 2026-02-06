"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-team-500 to-team-700 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="14" y="10" width="36" height="44" rx="2" fill="#E8E0D8" stroke="#967B5D" strokeWidth="1.5" />
              <line x1="14" y1="32" x2="50" y2="32" stroke="#967B5D" strokeWidth="1.5" />
              <circle cx="32" cy="32" r="7" stroke="#967B5D" strokeWidth="1.5" fill="none" />
              <rect x="20" y="10" width="24" height="10" stroke="#967B5D" strokeWidth="1.5" fill="none" />
              <rect x="20" y="44" width="24" height="10" stroke="#967B5D" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">네모의 꿈</h1>
          <p className="text-team-100">팀원들과 함께 성장하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
            로그인
          </h2>

          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 계속하기
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            로그인하면 팀원들과 운동 일지를 공유할 수 있어요
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-team-100">
          네모의 꿈과 함께 더 나은 선수가 되세요
        </p>
      </div>
    </div>
  );
}
