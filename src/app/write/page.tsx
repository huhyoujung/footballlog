"use client";
import LoadingSpinner from "@/components/LoadingSpinner";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ConditionPicker from "@/components/ConditionPicker";
import MentionTextarea from "@/components/MentionTextarea";
import { getConditionLevel, getConditionColor } from "@/lib/condition";

export default function WritePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500"></div>
        </div>
      }
    >
      <WritePageContent />
    </Suspense>
  );
}

function WritePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      name: string | null;
      position: string | null;
      number: number | null;
    }>
  >([]);
  const [formData, setFormData] = useState<{
    trainingDate: string;
    condition: number | null;
    conditionReason: string;
    keyPoints: string;
    improvement: string;
  }>({
    trainingDate: new Date().toISOString().split("T")[0],
    condition: null,
    conditionReason: "",
    keyPoints: "",
    improvement: "",
  });

  // 편집 모드: 기존 데이터 로드
  useEffect(() => {
    if (!editId) return;

    const fetchLog = async () => {
      try {
        const res = await fetch(`/api/training-logs/${editId}`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            trainingDate: new Date(data.trainingDate).toISOString().split("T")[0],
            condition: data.condition,
            conditionReason: data.conditionReason,
            keyPoints: data.keyPoints,
            improvement: data.improvement,
          });
          if (data.imageUrl) {
            setImagePreview(data.imageUrl);
          }
        } else {
          setError("일지를 불러올 수 없습니다");
        }
      } catch {
        setError("일지를 불러올 수 없습니다");
      } finally {
        setLoadingData(false);
      }
    };

    fetchLog();
  }, [editId]);

  // 팀원 목록 로드
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
        }
      } catch {
        // 팀원 목록 로드 실패 시 무시 (멘션 기능만 사용 불가)
      }
    };

    fetchTeamMembers();
  }, []);

  const isFormComplete =
    formData.condition !== null &&
    formData.conditionReason.trim() !== "" &&
    formData.keyPoints.trim() !== "" &&
    formData.improvement.trim() !== "";

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setLoading(true);
    setError("");

    try {
      if (isEditMode) {
        // 수정 모드: PUT
        const res = await fetch(`/api/training-logs/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "수정에 실패했습니다");
        }

        router.push(`/log/${editId}`);
      } else {
        // 신규 작성: POST
        let imageUrl = null;

        if (imageFile) {
          const uploadData = new FormData();
          uploadData.append("file", imageFile);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          });

          if (!uploadRes.ok) {
            const data = await uploadRes.json();
            throw new Error(data.error || "이미지 업로드에 실패했습니다");
          }

          const { url } = await uploadRes.json();
          imageUrl = url;
        }

        const res = await fetch("/api/training-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, imageUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "작성에 실패했습니다");
        }

        router.push("/");
      }
    } catch (err) {
      console.error("일지 제출 오류:", err);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const condSelected = formData.condition !== null;
  const condLevel = condSelected ? getConditionLevel(formData.condition!) : null;
  const condColor = condSelected ? getConditionColor(formData.condition!) : "";

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={isEditMode ? `/log/${editId}` : "/"}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            {isEditMode ? "운동 일지 수정" : "운동 일지 작성"}
          </h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* 운동 날짜 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            운동 날짜
          </label>
          <input
            type="date"
            value={formData.trainingDate}
            onChange={(e) =>
              setFormData({ ...formData, trainingDate: e.target.value })
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            required
          />
        </div>

        {/* 컨디션 */}
        <button
          type="button"
          onClick={() => setShowConditionPicker(true)}
          className="w-full bg-white rounded-xl p-4 text-left"
        >
          {condSelected ? (
            <div className="flex items-center gap-3">
              <span
                className="text-2xl font-extrabold"
                style={{ color: condColor }}
              >
                {formData.condition}
              </span>
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {condLevel!.label}
                </span>
                <p className="text-xs text-gray-400">
                  {condLevel!.description}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                컨디션
              </span>
              <span className="text-sm text-gray-400">
                탭하여 선택
              </span>
            </div>
          )}
        </button>

        {/* 컨디션 이유 — 컨디션 선택 후에만 표시 */}
        {condSelected && (
          <div className="bg-white rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              컨디션 이유
            </label>
            <textarea
              value={formData.conditionReason}
              onChange={(e) =>
                setFormData({ ...formData, conditionReason: e.target.value })
              }
              placeholder="오늘 컨디션이 이런 이유는..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
            />
          </div>
        )}

        {/* 운동 핵심 포인트 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            핵심 포인트
          </label>
          <MentionTextarea
            value={formData.keyPoints}
            onChange={(value) =>
              setFormData({ ...formData, keyPoints: value })
            }
            teamMembers={teamMembers}
            placeholder="오늘 훈련에서 좋았던 점, 집중했던 부분, 코치님 피드백, 전술적으로 신경 쓴 점 등을 자유롭게 적어주세요. @팀원이름 으로 태그할 수 있습니다."
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
          />
        </div>

        {/* 더 잘하기 위해서는 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            더 잘하기 위해서는?
          </label>
          <MentionTextarea
            value={formData.improvement}
            onChange={(value) =>
              setFormData({ ...formData, improvement: value })
            }
            teamMembers={teamMembers}
            placeholder="다음 훈련에서 개선하고 싶은 점, 더 연습이 필요한 부분을 적어주세요. @팀원이름 으로 태그할 수 있습니다."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
          />
        </div>

        {/* 이미지 첨부 - 신규 작성 시에만 */}
        {!isEditMode && (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => !imagePreview && fileInputRef.current?.click()}
              className="w-52 bg-white rounded-sm p-3 pb-6 cursor-pointer"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
            >
              {imagePreview ? (
                <div className="relative w-full aspect-[4/3]">
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="w-full h-full object-cover rounded-sm"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage();
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-full aspect-[4/3] bg-team-50 rounded-sm flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C3A587" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        )}

        {/* 수정 모드에서 기존 이미지 표시 */}
        {isEditMode && imagePreview && (
          <div className="flex flex-col items-center">
            <div
              className="w-52 bg-white rounded-sm p-3 pb-6"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
            >
              <img
                src={imagePreview}
                alt="기존 사진"
                className="w-full aspect-[4/3] object-cover rounded-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">사진은 수정할 수 없습니다</p>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
      </main>

      {/* 하단 제출 CTA */}
      {isFormComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {loading ? "저장 중..." : isEditMode ? "수정 완료" : "일지 올리기"}
            </button>
          </div>
        </div>
      )}

      {showConditionPicker && (
        <ConditionPicker
          value={formData.condition ?? 5}
          onConfirm={(val) => {
            setFormData({ ...formData, condition: val });
            setShowConditionPicker(false);
          }}
          onClose={() => setShowConditionPicker(false)}
        />
      )}
    </div>
  );
}
