"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("パスワードが違います。もう一度お試しください。");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("通信に失敗しました。電波状況を確認してもう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-cream px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-card rounded-2xl shadow-sm p-6 space-y-4"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-neutral-900">
            Instagram投稿ツール
          </h1>
          <p className="text-sm text-neutral-500">
            合言葉を入力してください
          </p>
        </div>
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full text-base rounded-xl border border-neutral-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="合言葉"
        />
        {error && (
          <p role="alert" className="text-sm text-danger flex items-center gap-1">
            ⚠ {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full min-h-11 rounded-xl bg-accent text-white font-bold py-3 disabled:opacity-50"
        >
          {loading ? "確認中..." : "入る"}
        </button>
      </form>
    </main>
  );
}
