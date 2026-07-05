"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhotoStep from "@/components/PhotoStep";
import DraftEditor from "@/components/DraftEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { enhancePhoto, type EnhancedImage } from "@/lib/imageEnhance";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draft";
import { buildFinalText } from "@/lib/postText";
import { presentError, isFailureStage, type FailureStage } from "@/lib/errorMessages";

export default function HomePage() {
  const [enhanced, setEnhanced] = useState<EnhancedImage | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [captionJa, setCaptionJa] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hasDraft, setHasDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [captionErrorStage, setCaptionErrorStage] = useState<FailureStage | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErrorStage, setPublishErrorStage] = useState<FailureStage | null>(null);
  const [published, setPublished] = useState(false);
  const [publishedPermalink, setPublishedPermalink] = useState<string | null>(null);

  // 下書き（テキストのみ）の復元
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setKeyword(draft.keyword);
      setCaptionJa(draft.captionJa);
      setCaptionEn(draft.captionEn);
      setHashtags(draft.hashtags);
      if (draft.captionJa || draft.captionEn) setHasDraft(true);
    }
  }, []);

  // 下書きの自動保存
  useEffect(() => {
    if (!hasDraft && !keyword) return;
    saveDraft({ keyword, captionJa, captionEn, hashtags });
  }, [keyword, captionJa, captionEn, hashtags, hasDraft]);

  async function handleFileSelected(file: File) {
    setPhotoError(null);
    setPhotoProcessing(true);
    try {
      const result = await enhancePhoto(file);
      setEnhanced(result);
    } catch {
      setPhotoError("写真の読み込みに失敗しました。別の写真でお試しください。");
    } finally {
      setPhotoProcessing(false);
    }
  }

  async function handleGenerate() {
    if (!enhanced) return;
    setGenerating(true);
    setCaptionErrorStage(null);
    try {
      const form = new FormData();
      form.append("photo", enhanced.blob, "photo.jpg");
      form.append("keyword", keyword);
      const res = await fetch("/api/generate-caption", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setCaptionErrorStage(isFailureStage(json?.stage) ? json.stage : "caption");
        return;
      }
      setCaptionJa(json.caption_ja);
      setCaptionEn(json.caption_en);
      setHashtags(json.hashtags);
      setHasDraft(true);
    } catch {
      setCaptionErrorStage("caption");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!enhanced) return;
    setPublishing(true);
    setPublishErrorStage(null);
    try {
      const form = new FormData();
      form.append("photo", enhanced.blob, "photo.jpg");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        setPublishErrorStage(isFailureStage(uploadJson?.stage) ? uploadJson.stage : "upload");
        return;
      }

      const finalText = buildFinalText(captionJa, captionEn, hashtags);
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadJson.url, caption: finalText }),
      });
      const publishJson = await publishRes.json();
      if (!publishRes.ok) {
        setPublishErrorStage(isFailureStage(publishJson?.stage) ? publishJson.stage : "publish");
        return;
      }

      setPublishedPermalink(publishJson.permalink ?? null);
      setPublished(true);
      setConfirmOpen(false);
      clearDraft();
    } catch {
      setPublishErrorStage("publish");
    } finally {
      setPublishing(false);
    }
  }

  async function handleShorten(currentCaptionJa: string, currentCaptionEn: string) {
    const res = await fetch("/api/shorten-caption", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ captionJa: currentCaptionJa, captionEn: currentCaptionEn }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { captionJa: json.caption_ja as string, captionEn: json.caption_en as string };
  }

  const finalText = buildFinalText(captionJa, captionEn, hashtags);
  const canPublish = hasDraft && !!enhanced && captionJa.trim().length > 0;

  if (published) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm p-6 space-y-4 text-center">
          <p className="text-2xl">✅</p>
          <h1 className="text-base font-bold">投稿しました</h1>
          {publishedPermalink && (
            <a
              href={publishedPermalink}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-accent underline underline-offset-2 text-sm"
            >
              Instagramで見る
            </a>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-11 rounded-xl border border-neutral-300 font-medium py-3"
          >
            もう一枚投稿する
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-lg font-bold">Instagram投稿ツール</h1>
          <Link href="/pool" className="text-sm font-medium text-accent underline underline-offset-2">
            写真プールへ
          </Link>
        </div>

        <PhotoStep
          enhanced={enhanced}
          processing={photoProcessing}
          error={photoError}
          keyword={keyword}
          onKeywordChange={setKeyword}
          onFileSelected={handleFileSelected}
        />

        <DraftEditor
          canGenerate={!!enhanced}
          generating={generating}
          hasDraft={hasDraft}
          captionJa={captionJa}
          captionEn={captionEn}
          hashtags={hashtags}
          onGenerate={handleGenerate}
          onShorten={handleShorten}
          onChangeCaptionJa={setCaptionJa}
          onChangeCaptionEn={setCaptionEn}
          onChangeHashtags={setHashtags}
          errorStage={captionErrorStage}
        />

        {hasDraft && (
          <section className="bg-card rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-base font-bold">3. 投稿する</h2>
            {publishErrorStage && (
              <div className="rounded-xl bg-danger/10 p-3 space-y-2">
                <p role="alert" className="text-sm text-danger flex items-center gap-1">
                  ⚠ {presentError(publishErrorStage).title}
                </p>
              </div>
            )}
            <p className="text-sm text-neutral-500">
              内容を確認したら、下のボタンからInstagramに投稿できます。
            </p>
          </section>
        )}
      </div>

      {hasDraft && enhanced && (
        <div className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-neutral-200 safe-bottom">
          <div className="max-w-md mx-auto px-4 pt-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canPublish}
              className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3 disabled:opacity-40"
            >
              Instagramに投稿
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        imageDataUrl={enhanced?.afterDataUrl ?? ""}
        finalText={finalText}
        publishing={publishing}
        onConfirm={handlePublish}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
