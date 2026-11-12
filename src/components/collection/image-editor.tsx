"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCw, X } from "lucide-react";

// Crop region, normalized 0..1 over the *rotated* image. Drag the body to move,
// drag a corner handle to resize. Mobile-first: pointer events cover touch+mouse.
type Crop = { x: number; y: number; w: number; h: number };
type Drag =
  | { kind: "move"; px: number; py: number; start: Crop }
  | { kind: "resize"; corner: string; px: number; py: number; start: Crop }
  | null;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const MIN = 0.1; // smallest crop edge
const MAXBOX = { w: 340, h: 440 };

// Draw the source image onto a canvas rotated by 0/90/180/270°.
function rotatedCanvas(img: HTMLImageElement, rotation: number): HTMLCanvasElement {
  const swap = rotation === 90 || rotation === 270;
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  return c;
}

export function ImageEditor({ src, onCancel, onSave }: {
  src: string; onCancel: () => void; onSave: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tainted, setTainted] = useState(false); // cross-origin image that can't export
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 1, h: 1 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag>(null);

  // Load the image. Try CORS first (lets us export remote photos); fall back to a
  // plain load for display only (export will be blocked → we warn).
  useEffect(() => {
    let alive = true;
    const withCors = new window.Image();
    withCors.crossOrigin = "anonymous";
    withCors.onload = () => { if (alive) { setImg(withCors); setTainted(false); } };
    withCors.onerror = () => {
      const plain = new window.Image();
      plain.onload = () => { if (alive) { setImg(plain); setTainted(true); } };
      plain.onerror = () => { if (alive) setErr("Could not load image."); };
      plain.src = src;
    };
    withCors.src = src;
    return () => { alive = true; };
  }, [src]);

  // Fitted display dimensions of the rotated image.
  const dispDims = useCallback(() => {
    if (!img) return { w: 0, h: 0 };
    const swap = rotation === 90 || rotation === 270;
    const iw = swap ? img.naturalHeight : img.naturalWidth;
    const ih = swap ? img.naturalWidth : img.naturalHeight;
    const scale = Math.min(MAXBOX.w / iw, MAXBOX.h / ih, 1);
    return { w: Math.round(iw * scale), h: Math.round(ih * scale) };
  }, [img, rotation]);

  // Paint the rotated preview whenever the image or rotation changes.
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const { w, h } = dispDims();
    const canvas = canvasRef.current;
    canvas.width = w; canvas.height = h;
    const rc = rotatedCanvas(img, rotation);
    canvas.getContext("2d")!.drawImage(rc, 0, 0, w, h);
  }, [img, rotation, dispDims]);

  function onPointerDown(e: React.PointerEvent, kind: "move" | "resize", corner = "") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = kind === "move"
      ? { kind: "move", px: e.clientX, py: e.clientY, start: crop }
      : { kind: "resize", corner, px: e.clientX, py: e.clientY, start: crop };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const dxN = (e.clientX - d.px) / rect.width;
    const dyN = (e.clientY - d.py) / rect.height;
    let { x, y, w, h } = d.start;
    if (d.kind === "move") {
      x = clamp(x + dxN, 0, 1 - w);
      y = clamp(y + dyN, 0, 1 - h);
    } else {
      const c = d.corner;
      if (c.includes("w")) { const nx = clamp(x + dxN, 0, x + w - MIN); w = w + (x - nx); x = nx; }
      if (c.includes("e")) { w = clamp(w + dxN, MIN, 1 - x); }
      if (c.includes("n")) { const ny = clamp(y + dyN, 0, y + h - MIN); h = h + (y - ny); y = ny; }
      if (c.includes("s")) { h = clamp(h + dyN, MIN, 1 - y); }
    }
    setCrop({ x, y, w, h });
  }
  function onPointerUp() { dragRef.current = null; }

  async function apply() {
    if (!img) return;
    setSaving(true); setErr(null);
    try {
      const rc = rotatedCanvas(img, rotation);
      const sx = crop.x * rc.width, sy = crop.y * rc.height;
      const sw = Math.max(1, crop.w * rc.width), sh = Math.max(1, crop.h * rc.height);
      const out = document.createElement("canvas");
      out.width = Math.round(sw); out.height = Math.round(sh);
      out.getContext("2d")!.drawImage(rc, sx, sy, sw, sh, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", 0.9));
      if (!blob) throw new Error("Export failed.");
      onSave(blob);
    } catch (e) {
      // Tainted canvas (cross-origin) throws on toBlob.
      setErr(tainted ? "This image can't be edited (cross-origin). Re-upload to crop." : (e as Error).message);
      setSaving(false);
    }
  }

  const { w: dw, h: dh } = dispDims();

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-white/10 bg-base p-4">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-semibold text-ink">Crop &amp; rotate</span>
          <button onClick={onCancel} className="p-1 text-muted hover:text-ink"><X className="size-5" /></button>
        </div>

        {/* Fixed-height stage so the Rotate/Reset/Apply row below never moves as
            the image rotates (portrait↔landscape); the image box centers within it. */}
        <div className="flex w-full items-center justify-center" style={{ height: MAXBOX.h }}>
        <div
          ref={boxRef}
          className="relative touch-none select-none"
          style={{ width: dw || MAXBOX.w, height: dh || MAXBOX.h }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {img ? (
            <div
              className="absolute cursor-move border-2 border-brand"
              style={{
                left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
              onPointerDown={(e) => onPointerDown(e, "move")}
            >
              {(["nw", "ne", "sw", "se"] as const).map((c) => (
                <span
                  key={c}
                  onPointerDown={(e) => onPointerDown(e, "resize", c)}
                  className="absolute size-5 rounded-full border-2 border-brand bg-base"
                  style={{
                    left: c.includes("w") ? -10 : undefined, right: c.includes("e") ? -10 : undefined,
                    top: c.includes("n") ? -10 : undefined, bottom: c.includes("s") ? -10 : undefined,
                    touchAction: "none",
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted">Loading…</div>
          )}
        </div>
        </div>

        {err ? <p className="text-xs text-gold">{err}</p> : null}

        <div className="flex w-full items-center justify-between gap-2">
          <button onClick={() => setRotation((r) => (r + 90) % 360)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-ink hover:bg-white/5">
            <RotateCw className="size-4" /> Rotate
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setCrop({ x: 0, y: 0, w: 1, h: 1 }); setRotation(0); }} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-ink">Reset</button>
            <button onClick={apply} disabled={saving || !img} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Check className="size-4" /> {saving ? "Saving…" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
