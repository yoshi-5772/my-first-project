"use client";

import { useState } from "react";
import { presentError, type FailureStage } from "@/lib/errorMessages";

interface DraftEditorProps {
  canGenerate: boolean;
  generating: boolean;
  hasDraft: boolean;
  captionJa: string;
  captionEn: string;
  hashtags: string[];
  onGenerate: () => void;
  onChangeCaptionJa: (value: string) => void;
  onChangeCaptionEn: (value: string) => void;
  onChangeHashtags: (hashtags: string[]) => void;
  errorStage: FailureStage | null;
}

const FEED_PREVIEW_LIMIT = 125;

export default function DraftEditor({
  canGenerate,
  generating,
  hasDraft,
  captionJa,
  captionEn,
  hashtags,
  onGenerate,
  onChangeCaptionJa,
  onChangeCaptionEn,
  onChangeHashtags,
  errorStage,
}: DraftEditorProps) {
  const [showEnglish, setShowEnglish] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [copied, setCopied] = useState(false);

  const finalText = buildFinalText(captionJa, captionEn, hashtags);
  const isTruncated = finalText.length > FEED_PREVIEW_LIMIT;
  const truncatedText = isTruncated ? `${finalText.slice(0, FEED_PREVIEW_LIMIT)}…` : finalText;

  async function handleCopy() {
    const text = [captionJa.trim(), captionEn.trim()].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない環境ではボタンを無反応にするだけに留める
    }
  }

  function addTag() {
    const tag = newTag.trim();
    if (!tag) return;
    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    onChangeHashtags([...hashtags, normalized]);
    setNewTag("");
  }

  function removeTag(index: number) {
    onChangeHashtags(hashtags.filter((_, i) => i !== index));
  }

  return (
    <section className="bg-card rounded-2xl shadow-sm p-5 space-y-4">
      <h2 className="text-base font-bold">2. 下書きを作る</h2>

      {!hasDraft && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3 disabled:opacity-40"
        >
          {generating ? "作成中..." : "キャプションを作る"}
        </button>
      )}

      {generating && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-neutral-500">AIが写真を見てキャプションを考えています...</p>
          <div className="h-4 rounded bg-neutral-100 animate-pulse w-3/4" />
          <div className="h-4 rounded bg-neutral-100 animate-pulse w-1/2" />
        </div>
      )}

      {errorStage && (
        <div className="rounded-xl bg-danger/10 p-3 space-y-2">
          <p role="alert" className="text-sm text-danger flex items-center gap-1">
            ⚠ {presentError(errorStage).title}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="text-sm font-medium text-accent underline underline-offset-2"
          >
            {presentError(errorStage).actionLabel}
          </button>
        </div>
      )}

      {hasDraft && !generating && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className="text-sm font-medium text-accent underline underline-offset-2 disabled:opacity-40"
          >
            この写真で作り直す
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent underline underline-offset-2"
          >
            {copied ? "コピーしました ✓" : "日本語・英語をコピー"}
          </button>

          <div className="space-y-1">
            <label htmlFor="caption-ja" className="text-sm font-medium text-neutral-700">
              日本語キャプション
            </label>
            <textarea
              id="caption-ja"
              value={captionJa}
              onChange={(e) => onChangeCaptionJa(e.target.value)}
              rows={3}
              className="w-full text-base rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowEnglish((v) => !v)}
              className="text-sm font-medium text-accent underline underline-offset-2"
            >
              {showEnglish ? "英訳を閉じる" : "英訳を確認"}
            </button>
            {showEnglish && (
              <textarea
                aria-label="英語キャプション"
                value={captionEn}
                onChange={(e) => onChangeCaptionEn(e.target.value)}
                rows={3}
                className="w-full text-base rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            )}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-neutral-700">ハッシュタグ</span>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    aria-label={`${tag}を削除`}
                    className="text-neutral-400 hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="タグを追加"
                className="flex-1 text-base rounded-xl border border-neutral-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={addTag}
                className="min-h-11 px-4 rounded-xl border border-neutral-300 font-medium"
              >
                追加
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">フィード上での見え方</span>
            <div className="rounded-xl border border-neutral-200 p-3 text-sm whitespace-pre-wrap">
              {truncatedText}
              {isTruncated && <span className="text-neutral-400"> 続きを読む</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const HASHTAG_SEPARATOR = ".\n.\n.";

export function buildFinalText(captionJa: string, captionEn: string, hashtags: string[]): string {
  const captionParts = [captionJa.trim(), captionEn.trim()].filter(Boolean);
  const tagsText = hashtags.join(" ");
  const sections = [...captionParts];
  if (tagsText) {
    sections.push(HASHTAG_SEPARATOR, tagsText);
  }
  return sections.join("\n\n");
}
