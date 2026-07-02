"use client";

import { useRef, useState } from "react";
import type { EnhancedImage } from "@/lib/imageEnhance";

interface PhotoStepProps {
  enhanced: EnhancedImage | null;
  processing: boolean;
  error: string | null;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onFileSelected: (file: File) => void;
}

export default function PhotoStep({
  enhanced,
  processing,
  error,
  keyword,
  onKeywordChange,
  onFileSelected,
}: PhotoStepProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [showAfter, setShowAfter] = useState(true);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFileSelected(file);
  }

  return (
    <section className="bg-card rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-base font-bold">1. 写真を選ぶ</h2>

      {!enhanced && !processing && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3"
          >
            📷 その場で撮影する
          </button>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            className="w-full min-h-11 rounded-xl border border-neutral-300 text-neutral-700 font-medium py-3"
          >
            アルバムから選ぶ
          </button>
        </div>
      )}

      {processing && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-4" aria-live="polite">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          写真を調整しています...
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger flex items-center gap-1">
          ⚠ {error}
        </p>
      )}

      {enhanced && !processing && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={showAfter ? enhanced.afterDataUrl : enhanced.beforeDataUrl}
              alt={showAfter ? "加工後の写真" : "加工前の写真"}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">
              {showAfter ? "加工後（自然な範囲で少しだけ補正）" : "加工前"}
            </span>
            <button
              type="button"
              onClick={() => setShowAfter((v) => !v)}
              className="min-h-11 px-4 rounded-full border border-neutral-300 font-medium"
            >
              {showAfter ? "加工前と比べる" : "加工後を見る"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="text-sm text-accent font-medium underline underline-offset-2"
          >
            別の写真を選び直す
          </button>
        </div>
      )}

      <div className="space-y-1 pt-2">
        <label htmlFor="keyword" className="text-sm font-medium text-neutral-700">
          ひとことキーワード（任意）
        </label>
        <input
          id="keyword"
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="例：誕生日、新メニュー、秋の食材"
          className="w-full text-base rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </section>
  );
}
