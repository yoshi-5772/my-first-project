"use client";

import { useEffect, useState } from "react";
import DraftEditor from "@/components/DraftEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { buildFinalText } from "@/lib/postText";
import { presentError, isFailureStage, type FailureStage } from "@/lib/errorMessages";

interface DraftData {
  photoUrl: string;
  keyword: string;
  captionJa: string;
  captionEn: string;
  hashtags: string[];
  status: "pending" | "published";
  permalink: string | null;
}

interface DraftReviewProps {
  token: string;
}

export default function DraftReview({ token }: DraftReviewProps) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [draft, setDraft] = useState<DraftData | null>(null);

  const [captionJa, setCaptionJa] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [captionErrorStage, setCaptionErrorStage] = useState<FailureStage | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErrorStage, setPublishErrorStage] = useState<FailureStage | null>(null);
  const [published, setPublished] = useState(false);
  const [publishedPermalink, setPublishedPermalink] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/draft/${token}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        const d: DraftData = json.draft;
        setDraft(d);
        setCaptionJa(d.captionJa);
        setCaptionEn(d.captionEn);
        setHashtags(d.hashtags);
        if (d.status === "published") {
          setPublished(true);
          setPublishedPermalink(d.permalink);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleGenerate() {
    setGenerating(true);
    setCaptionErrorStage(null);
    try {
      const res = await fetch(`/api/draft/${token}/regenerate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setCaptionErrorStage(isFailureStage(json?.stage) ? json.stage : "caption");
        return;
      }
      setCaptionJa(json.caption_ja);
      setCaptionEn(json.caption_en);
      setHashtags(json.hashtags);
    } catch {
      setCaptionErrorStage("caption");
    } finally {
      setGenerating(false);
    }
  }

  async function handleShorten(currentCaptionJa: string, currentCaptionEn: string) {
    const res = await fetch(`/api/draft/${token}/shorten`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ captionJa: currentCaptionJa, captionEn: currentCaptionEn }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { captionJa: json.caption_ja as string, captionEn: json.caption_en as string };
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishErrorStage(null);
    try {
      const res = await fetch(`/api/draft/${token}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ captionJa, captionEn, hashtags }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPublishErrorStage(isFailureStage(json?.stage) ? json.stage : "publish");
        return;
      }
      setPublishedPermalink(json.permalink ?? null);
      setPublished(true);
      setConfirmOpen(false);
    } catch {
      setPublishErrorStage("publish");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-cream px-4">
        <p className="text-sm text-neutral-500">読み込み中...</p>
      </main>
    );
  }

  if (notFound || !draft) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm p-6 space-y-2 text-center">
          <p className="text-2xl">⚠</p>
          <h1 className="text-base font-bold">下書きが見つかりませんでした</h1>
          <p className="text-sm text-neutral-500">リンクが無効か、期限切れの可能性があります。</p>
        </div>
      </main>
    );
  }

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
        </div>
      </main>
    );
  }

  const finalText = buildFinalText(captionJa, captionEn, hashtags);
  const hasDraft = captionJa.trim().length > 0;

  return (
    <main className="min-h-dvh bg-cream pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <h1 className="text-lg font-bold px-1">今夜の投稿候補</h1>

        <section className="bg-card rounded-2xl shadow-sm p-5 space-y-3">
          <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.photoUrl} alt="投稿候補の写真" className="w-full h-full object-cover" />
          </div>
          {draft.keyword && <p className="text-sm text-neutral-500">キーワード: {draft.keyword}</p>}
        </section>

        <DraftEditor
          canGenerate
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
      </div>

      {hasDraft && (
        <div className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-neutral-200 safe-bottom">
          <div className="max-w-md mx-auto px-4 pt-3">
            {publishErrorStage && (
              <p role="alert" className="text-sm text-danger flex items-center gap-1 pb-2">
                ⚠ {presentError(publishErrorStage).title}
              </p>
            )}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3"
            >
              Instagramに投稿
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        imageDataUrl={draft.photoUrl}
        finalText={finalText}
        publishing={publishing}
        onConfirm={handlePublish}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
