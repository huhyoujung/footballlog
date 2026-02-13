"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { Shirt, Plus, Trash2, Pencil, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Uniform {
  id: string;
  name: string;
  color: string;
}

export default function UniformManager() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUniform, setEditingUniform] = useState<Uniform | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF0000");
  const [submitting, setSubmitting] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const { data, mutate } = useSWR<{ uniforms: Uniform[] }>(
    "/api/teams/uniforms",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const uniforms = data?.uniforms || [];

  const handleAdd = async () => {
    if (!name.trim() || !color) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/teams/uniforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });

      if (res.ok) {
        setName("");
        setColor("#FF0000");
        setShowAddModal(false);
        mutate();
      } else {
        const data = await res.json();
        alert(data.error || "추가에 실패했습니다");
      }
    } catch {
      alert("추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUniform || !name.trim() || !color) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/teams/uniforms/${editingUniform.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });

      if (res.ok) {
        setEditingUniform(null);
        setName("");
        setColor("#FF0000");
        mutate();
      } else {
        const data = await res.json();
        alert(data.error || "수정에 실패했습니다");
      }
    } catch {
      alert("수정에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 유니폼을 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/teams/uniforms/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        mutate();
      } else {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다");
      }
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  const openEditModal = (uniform: Uniform) => {
    setEditingUniform(uniform);
    setName(uniform.name);
    setColor(uniform.color);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setEditingUniform(null);
    setName("");
    setColor("#FF0000");
  };

  return (
    <div className="bg-white rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">유니폼 관리</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-team-500 text-white text-sm rounded-lg hover:bg-team-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>추가</span>
        </button>
      </div>

      {uniforms.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">등록된 유니폼이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {uniforms.map((uniform) => (
            <div
              key={uniform.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Shirt
                  className="w-5 h-5"
                  style={{ fill: uniform.color, stroke: '#9CA3AF' }}
                  strokeWidth={1.5}
                />
                <p className="text-sm font-medium text-gray-900">{uniform.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(uniform)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(uniform.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {(showAddModal || editingUniform) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModals}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingUniform ? "유니폼 수정" : "유니폼 추가"}
              </h3>
              <button
                onClick={closeModals}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 홈, 원정, 3rd"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  색상
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Shirt
                      className="w-8 h-8"
                      style={{ fill: color, stroke: '#9CA3AF' }}
                      strokeWidth={1.5}
                    />
                  </button>
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="hidden"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#FF0000"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModals}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={editingUniform ? handleUpdate : handleAdd}
                disabled={!name.trim() || !color || submitting}
                className="flex-1 py-3 bg-team-500 text-white rounded-lg font-medium hover:bg-team-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "처리중..." : editingUniform ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
