"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { enhancePhoto, type EnhancedImage } from "@/lib/imageEnhance";
import type { PoolItem } from "@/lib/pool";

export default function PoolPage() {
  const [items, setItems] = useState<PoolItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [listError, setListError] = useState(false);

  const [enhanced, setEnhanced] = useState<EnhancedImage | null>(null);
  const [keyword, setKeyword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [hour, setHour] = useState("23");
  const [minute, setMinute] = useState("00");
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  useEffect(() => {
    loadItems();
    loadSchedule();
  }, []);

  async function loadItems() {
    setLoadingItems(true);
    setListError(false);
    try {
      const res = await fetch("/api/pool");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.items);
    } catch {
      setListError(true);
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadSchedule() {
    try {
      const res = await fetch("/api/settings/schedule");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setHour(String(json.hour).padStart(2, "0"));
      setMinute(String(json.minute).padStart(2, "0"));
    } catch {
      // 読み込みに失敗してもデフォルト値のままにしておく
    } finally {
      setScheduleLoaded(true);
    }
  }

  async function handleFileSelected(file: File) {
    setAddError(null);
    setProcessing(true);
    try {
      const result = await enhancePhoto(file);
      setEnhanced(result);
    } catch {
      setAddError("写真の読み込みに失敗しました。別の写真でお試しください。");
    } finally {
      setProcessing(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFileSelected(file);
  }

  function handleLibraryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (files.length === 1) {
      handleFileSelected(files[0]);
      return;
    }
    handleBulkAdd(files);
  }

  async function handleBulkAdd(files: File[]) {
    setAddError(null);
    setBulkProgress({ done: 0, total: files.length });
    let failedCount = 0;
    for (const file of files) {
      try {
        const result = await enhancePhoto(file);
        const form = new FormData();
        form.append("photo", result.blob, "photo.jpg");
        form.append("keyword", keyword);
        const res = await fetch("/api/pool", { method: "POST", body: form });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setItems((prev) => [json.item, ...prev]);
      } catch {
        failedCount += 1;
      }
      setBulkProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    setBulkProgress(null);
    setKeyword("");
    if (failedCount > 0) {
      setAddError(`${failedCount}枚の追加に失敗しました。もう一度お試しください。`);
    }
  }

  async function handleAdd() {
    if (!enhanced) return;
    setAdding(true);
    setAddError(null);
    try {
      const form = new FormData();
      form.append("photo", enhanced.blob, "photo.jpg");
      form.append("keyword", keyword);
      const res = await fetch("/api/pool", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setAddError("プールへの追加に失敗しました。もう一度お試しください。");
        return;
      }
      setItems((prev) => [json.item, ...prev]);
      setEnhanced(null);
      setKeyword("");
    } catch {
      setAddError("プールへの追加に失敗しました。もう一度お試しください。");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/pool/${id}`, { method: "DELETE" });
    } catch {
      loadItems();
    }
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setScheduleSaved(false);
    try {
      const res = await fetch("/api/settings/schedule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hour: Number(hour), minute: Number(minute) }),
      });
      if (res.ok) {
        setScheduleSaved(true);
        setTimeout(() => setScheduleSaved(false), 1500);
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <main className="min-h-dvh bg-cream pb-16">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-lg font-bold">写真プール</h1>
          <Link href="/" className="text-sm font-medium text-accent underline underline-offset-2">
            投稿画面へ
          </Link>
        </div>

        <section className="bg-card rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold">写真を追加</h2>

          {!enhanced && !processing && !bulkProgress && (
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
                アルバムから選ぶ（複数選択可）
              </button>
            </div>
          )}

          {bulkProgress && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 py-4" aria-live="polite">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              写真を追加しています（{bulkProgress.done}/{bulkProgress.total}）...
            </div>
          )}

          {processing && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 py-4" aria-live="polite">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              写真を調整しています...
            </div>
          )}

          {enhanced && !processing && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enhanced.afterDataUrl} alt="加工後の写真" className="w-full h-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => setEnhanced(null)}
                className="text-sm text-accent font-medium underline underline-offset-2"
              >
                別の写真を選び直す
              </button>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pool-keyword" className="text-sm font-medium text-neutral-700">
              ひとことキーワード（任意）
            </label>
            <input
              id="pool-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例：誕生日、新メニュー、秋の食材"
              className="w-full text-base rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {addError && (
            <p role="alert" className="text-sm text-danger flex items-center gap-1">
              ⚠ {addError}
            </p>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!enhanced || adding}
            className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3 disabled:opacity-40"
          >
            {adding ? "追加中..." : "プールに追加"}
          </button>

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
            multiple
            className="hidden"
            onChange={handleLibraryChange}
          />
        </section>

        <section className="bg-card rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-base font-bold">自動下書きの作成時刻</h2>
          <p className="text-sm text-neutral-500">
            毎日この時刻になったら、プールからランダムに1枚選んで下書きを自動作成し、メールでお知らせします
            （自動投稿はしません）。
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-16 text-base rounded-xl border border-neutral-300 px-3 py-2 text-center"
            />
            <span>時</span>
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="w-16 text-base rounded-xl border border-neutral-300 px-3 py-2 text-center"
            />
            <span>分</span>
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={!scheduleLoaded || savingSchedule}
              className="ml-auto min-h-11 px-4 rounded-xl bg-accent text-white font-medium disabled:opacity-40"
            >
              {savingSchedule ? "保存中..." : scheduleSaved ? "保存しました ✓" : "保存"}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold px-1">プール中の写真（{items.length}枚）</h2>
          {loadingItems && <p className="text-sm text-neutral-500 px-1">読み込み中...</p>}
          {listError && (
            <p role="alert" className="text-sm text-danger px-1 flex items-center gap-1">
              ⚠ 一覧の取得に失敗しました。
            </p>
          )}
          {!loadingItems && items.length === 0 && !listError && (
            <p className="text-sm text-neutral-500 px-1">プールに写真がありません。</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.photoUrl}
                  alt={item.keyword || "プール写真"}
                  className="w-full aspect-[4/5] object-cover"
                />
                <div className="p-2 space-y-1">
                  {item.keyword && <p className="text-xs text-neutral-600 truncate">{item.keyword}</p>}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className={`text-xs font-medium underline underline-offset-2 ${
                      confirmDeleteId === item.id ? "text-danger" : "text-neutral-400"
                    }`}
                  >
                    {confirmDeleteId === item.id ? "本当に削除する" : "削除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
