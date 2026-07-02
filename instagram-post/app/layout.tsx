import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram投稿ツール",
  description: "写真から下書きを自動生成し、確認してから投稿するお店専用ツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-cream text-neutral-900 font-sans antialiased">{children}</body>
    </html>
  );
}
