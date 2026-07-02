"use client";

import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  imageDataUrl: string;
  finalText: string;
  publishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ENABLE_DELAY_MS = 800;

export default function ConfirmDialog({
  open,
  imageDataUrl,
  finalText,
  publishing,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!open) {
      setEnabled(false);
      return;
    }
    const timer = setTimeout(() => setEnabled(true), ENABLE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-bold">この内容でInstagramに投稿します</h2>
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageDataUrl}
            alt="投稿する写真"
            className="w-20 h-24 object-cover rounded-lg flex-shrink-0"
          />
          <p className="text-sm whitespace-pre-wrap line-clamp-6">{finalText}</p>
        </div>
        <p className="text-sm text-warning flex items-center gap-1">
          ⚠ 投稿後は取り消せません。内容をよく確認してください。
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={publishing}
            className="flex-1 min-h-11 rounded-xl border border-neutral-300 font-medium py-3 disabled:opacity-40"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!enabled || publishing}
            className="flex-1 min-h-11 rounded-xl bg-accent text-white font-bold py-3 disabled:opacity-40"
          >
            {publishing ? "投稿中..." : "投稿する"}
          </button>
        </div>
      </div>
    </div>
  );
}
