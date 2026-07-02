// ブラウザ側でのみ実行する（"use client"なコンポーネントから呼ぶ）
// 既存棚卸しアプリ index.html の FileReader→canvas リサイズパターンを踏襲

export interface EnhancedImage {
  beforeDataUrl: string; // 加工前プレビュー
  afterDataUrl: string; // 加工後プレビュー
  blob: Blob; // アップロード用JPEG
  width: number;
  height: number;
}

const TARGET_RATIO = 4 / 5; // Instagramの縦長投稿比率
const MAX_WIDTH = 1440;
// Vercel Functionsのリクエストボディ上限（既定4.5MB）に対して十分な余裕を残すサイズ
const MAX_BYTES = 3 * 1024 * 1024;
// やりすぎ防止のため、補正の強さは固定の控えめな1プリセットのみ。調整UIは持たせない
const ENHANCE_FILTER = "brightness(1.05) contrast(1.08) saturate(1.15)";

export async function enhancePhoto(file: File): Promise<EnhancedImage> {
  const img = await loadImage(file);
  const { sx, sy, sw, sh } = centerCropRect(img.naturalWidth, img.naturalHeight, TARGET_RATIO);

  const width = Math.min(MAX_WIDTH, sw);
  const height = Math.round(width / TARGET_RATIO);

  const beforeCanvas = drawToCanvas(img, sx, sy, sw, sh, width, height, null);
  const afterCanvas = drawToCanvas(img, sx, sy, sw, sh, width, height, ENHANCE_FILTER);

  const blob = await canvasToJpegUnderLimit(afterCanvas, MAX_BYTES);

  return {
    beforeDataUrl: beforeCanvas.toDataURL("image/jpeg", 0.9),
    afterDataUrl: afterCanvas.toDataURL("image/jpeg", 0.9),
    blob,
    width,
    height,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

function centerCropRect(width: number, height: number, targetRatio: number) {
  const currentRatio = width / height;
  if (currentRatio > targetRatio) {
    const sw = Math.round(height * targetRatio);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }
  const sh = Math.round(width / targetRatio);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

function drawToCanvas(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  width: number,
  height: number,
  filter: string | null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas;
}

async function canvasToJpegUnderLimit(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let quality = 0.85;
  for (let i = 0; i < 5; i++) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= maxBytes || quality <= 0.5) return blob;
    quality -= 0.1;
  }
  return canvasToBlob(canvas, 0.5);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))),
      "image/jpeg",
      quality,
    );
  });
}
