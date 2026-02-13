"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import useSWR from "swr";
import { usePushSubscription } from "@/lib/usePushSubscription";

const POSITIONS = [
  "감독",
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
];

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SettingsPage() {
  const router = useRouter();
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 푸시 알림 상태
  const { isSupported, isSubscribed, isReady, subscribe, unsubscribe } = usePushSubscription();
  const [subscribing, setSubscribing] = useState(false);

  // SWR로 profile 데이터 페칭
  const { data: profileData, isLoading: loading } = useSWR<Profile>(
    "/api/profile",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  // profile 데이터가 변경될 때마다 상태 업데이트
  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
      setName(profileData.name || "");
      setPosition(profileData.position || "");
      setNumber(profileData.number !== null ? String(profileData.number) : "");
      setImagePreview(profileData.image);
    }
  }, [profileData]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB 이하만 가능합니다");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "이미지 업로드에 실패했습니다");
      }

      const { url } = await uploadRes.json();
      setImagePreview(url);

      // 바로 프로필 이미지 업데이트
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: url }),
      });

      await update();
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          position: position || null,
          number: number ? parseInt(number) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      await update();
      setSuccess("저장되었습니다");
      setTimeout(() => {
        router.push("/my");
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (subscribing || !isReady) return;

    setSubscribing(true);
    setError("");
    setSuccess("");

    try {
      if (isSubscribed) {
        const result = await unsubscribe();
        if (result) {
          setSuccess("알림이 비활성화되었습니다");
        } else {
          setError("알림 해제에 실패했습니다");
        }
      } else {
        const result = await subscribe();
        if (result.success) {
          setSuccess("알림이 활성화되었습니다");
        } else {
          // 구체적인 에러 메시지 표시
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
          const isPWA = window.matchMedia('(display-mode: standalone)').matches;

          const errorMessages: Record<string, string> = {
            NOT_SUPPORTED: isIOS && !isPWA
              ? "iOS에서는 홈 화면에 추가한 후에만 푸시 알림을 사용할 수 있습니다"
              : "이 브라우저는 푸시 알림을 지원하지 않습니다",
            PERMISSION_DENIED: "알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요",
            VAPID_KEY_MISSING: "서버 설정 오류입니다. 관리자에게 문의하세요",
            SERVER_ERROR: "서버 구독 실패. 잠시 후 다시 시도해주세요",
            "Service worker timeout": "서비스 워커 준비 시간 초과. 페이지를 새로고침해주세요",
          };
          setError(errorMessages[result.error] || `오류: ${result.error}`);
        }
      }
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Push toggle error:", err);
      setError("알림 설정에 실패했습니다");
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-base font-semibold text-gray-900">내 프로필 수정</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-team-500 font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* 프로필 사진 */}
        <div className="bg-white rounded-xl p-6 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="프로필"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                  👤
                </div>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-team-500 text-sm font-medium"
          >
            {uploading ? "업로드 중..." : "사진 변경"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {/* 이름 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
        </div>

        {/* 포지션 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            포지션
          </label>
          <div className="grid grid-cols-5 gap-2">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(position === pos ? "" : pos)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  position === pos
                    ? "bg-team-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* 등번호 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            등번호
          </label>
          <input
            type="number"
            min="0"
            max="99"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="등번호를 입력하세요 (0~99)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
        </div>

        {/* 이메일 (읽기 전용) */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            이메일
          </label>
          <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500">
            {profile?.email}
          </p>
        </div>

        {/* 푸시 알림 설정 */}
        {isSupported && (
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                푸시 알림
              </label>
              <button
                type="button"
                onClick={handlePushToggle}
                disabled={subscribing || !isReady}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isSubscribed ? "bg-team-500" : "bg-gray-300"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isSubscribed ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {isSubscribed
                ? "닦달, 댓글, 좋아요 등의 알림을 받고 있습니다"
                : "알림을 켜면 중요한 소식을 놓치지 않아요"}
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
        {success && (
          <p className="text-team-500 text-sm text-center">{success}</p>
        )}
      </main>
    </div>
  );
}
