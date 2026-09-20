"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, X } from "lucide-react";
import type { ObjectDetection } from "@tensorflow-models/coco-ssd";

interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  score: number;
}

async function getUserMediaSafe(): Promise<MediaStream> {
  const nav = navigator as Navigator & { mediaDevices?: MediaDevices };
  if (!nav.mediaDevices?.getUserMedia) throw new Error("camera unsupported");
  try {
    return await nav.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  } catch {
    return await nav.mediaDevices.getUserMedia({ audio: false, video: true });
  }
}

export default function LiveScan({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<ObjectDetection | null>(null);
  const loopTimer = useRef(0);
  const [status, setStatus] = useState<"starting" | "loading-model" | "running" | "failed">("starting");
  const [failure, setFailure] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const detectionsRef = useRef<Detection[]>([]);

  useEffect(() => {
    let cancelled = false;
    let modelRetry = 0;

    const stopAll = () => {
      window.clearTimeout(loopTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        modelRef.current?.dispose?.();
      } catch {
        // dispose is best-effort
      }
    };

    async function attachVideo(stream: MediaStream): Promise<boolean> {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
          return true;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    }

    async function start() {
      let stream: MediaStream | null = null;
      try {
        stream = await getUserMediaSafe();
      } catch {
        if (!cancelled) {
          setStatus("failed");
          setFailure("camera_unavailable");
        }
        return;
      }
      streamRef.current = stream;
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const attached = await attachVideo(stream);
      if (!attached || cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setStatus("loading-model");
      try {
        const [tf, coco] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/coco-ssd"),
        ]);
        let backend: string;
        try {
          await tf.setBackend("webgl");
          backend = "webgl";
        } catch {
          await import("@tensorflow/tfjs-backend-wasm").catch(() => undefined);
          try {
            await tf.setBackend("wasm");
            backend = "wasm";
          } catch {
            backend = tf.getBackend();
          }
        }
        await tf.ready();
        console.log(`[LiveScan] tfjs backend: ${backend} (${tf.getBackend()})`);
        const model = await coco.load({ base: "lite_mobilenet_v2" });
        if (cancelled) {
          model.dispose?.();
          return;
        }
        modelRef.current = model;
        setStatus("running");
      } catch (err) {
        if (!cancelled) {
          setStatus("failed");
          setFailure("model_load_failed");
          console.warn("LiveScan model load failed:", err);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const video = videoRef.current;
    const model = modelRef.current;
    const canvasEl = boxRef.current;
    if (!video || !model || !canvasEl) return;

    const DETECT_SCALE = 320;
    const detectCanvas = document.createElement("canvas");
    detectCanvas.style.display = "none";
    const ticks = { count: 0, since: performance.now(), logged: false };

    const detectOnce = async () => {
      if (video.videoWidth === 0) return;
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const dh = Math.max(1, Math.round((DETECT_SCALE * vh) / vw));
        if (detectCanvas.width !== DETECT_SCALE || detectCanvas.height !== dh) {
          detectCanvas.width = DETECT_SCALE;
          detectCanvas.height = dh;
        }
        const dctx = detectCanvas.getContext("2d");
        if (!dctx) return;
        dctx.drawImage(video, 0, 0, DETECT_SCALE, dh);
        const raw = await model.detect(detectCanvas, 10, 0.5);
        const sx = vw / DETECT_SCALE;
        const sy = vh / dh;
        const ds: Detection[] = raw
          .filter((d) => d.score >= 0.5)
          .map((d) => ({
            x: d.bbox[0] * sx,
            y: d.bbox[1] * sy,
            w: d.bbox[2] * sx,
            h: d.bbox[3] * sy,
            label: d.class,
            score: d.score,
          }));
        detectionsRef.current = ds;
        setDetections(ds);
        draw(ds);
      } catch {
        // transient detect error; keep the loop alive
      }
    }

    const draw = (ds: Detection[]) => {
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      const vw = video.videoWidth || canvasEl.width;
      const vh = video.videoHeight || canvasEl.height;
      if (canvasEl.width !== vw || canvasEl.height !== vh) {
        canvasEl.width = vw;
        canvasEl.height = vh;
      }
      ctx.clearRect(0, 0, vw, vh);
      for (const d of ds) {
        ctx.strokeStyle = "rgba(127,209,160,0.95)";
        ctx.lineWidth = Math.max(2, vw / 320);
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        ctx.fillStyle = "rgba(20,28,23,0.82)";
        const label = `${d.label} ${(d.score * 100).toFixed(0)}%`;
        ctx.font = `${Math.max(13, vw / 60)}px ui-monospace, monospace`;
        const tw = ctx.measureText(label).width + 12;
        const ly = d.y - 24 < 0 ? d.y : d.y - 24;
        ctx.fillRect(d.x, ly, tw, 22);
        ctx.fillStyle = "#7fd1a0";
        ctx.fillText(label, d.x + 6, ly + 16);
      }
    }

    const tick = () => {
      void detectOnce();
      ticks.count++;
      if (ticks.count === 10 && !ticks.logged) {
        const now = performance.now();
        const rate = (ticks.count * 1000) / (now - ticks.since);
        console.log(`[LiveScan] detect rate: ${rate.toFixed(1)}/s (interval 200ms)`);
        ticks.logged = true;
      }
      loopTimer.current = window.setTimeout(tick, 200);
    };
    tick();

    return () => {
      window.clearTimeout(loopTimer.current);
      canvasEl?.getContext("2d")?.clearRect(0, 0, canvasEl.width, canvasEl.height);
    };
  }, [status]);

  function capture(region?: Detection) {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cv = document.createElement("canvas");
    const c = cv.getContext("2d");
    if (!c) return;
    if (region) {
      const pad = 0.1;
      const x = Math.max(0, region.x - region.w * pad);
      const y = Math.max(0, region.y - region.h * pad);
      const w = Math.min(vw - x, region.w * (1 + 2 * pad));
      const h = Math.min(vh - y, region.h * (1 + 2 * pad));
      cv.width = Math.max(1, Math.round(w));
      cv.height = Math.max(1, Math.round(h));
      c.drawImage(video, x, y, w, h, 0, 0, w, h);
    } else {
      cv.width = vw;
      cv.height = vh;
      c.drawImage(video, 0, 0);
    }
    onCapture(cv.toDataURL("image/jpeg", 0.92));
  }

  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video || video.videoWidth === 0) return;
    const rect = wrap.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
    const py = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
    const ds = detectionsRef.current;
    const hit = ds.find(
      (d) => px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h
    );
    if (hit && ds.length > 1) {
      navigator.vibrate?.(30);
      capture(hit);
    } else if (ds.length <= 1) {
      navigator.vibrate?.(30);
      capture();
    }
  }

  function handleCaptureClick() {
    navigator.vibrate?.(30);
    capture();
  }

  if (status === "failed") {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-muted">
        Live Scan could not start ({failure === "camera_unavailable" ? "camera unavailable or denied" : "vision model failed to load"}). No problem — use{" "}
        <span className="font-medium text-ink">Upload</span> above instead.
        <button
          type="button"
          onClick={onClose}
          className="ml-3 rounded-md bg-ink px-2 py-1 font-semibold text-paper hover:opacity-90"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-tier1/30 bg-paper/60 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <p className="flex items-center gap-2 text-xs font-semibold text-ink">
          <ScanLine className="h-4 w-4 text-tier1" aria-hidden="true" />
          Live Scan (beta)
          <span className="font-normal text-muted">
            — viewfinder aid only; the verdict still goes through the real pipeline
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close live scan"
          className="rounded-md p-1 text-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={wrapRef}
        onClick={onTap}
        className="relative cursor-crosshair bg-black/70"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCaptureClick();
          }
        }}
        aria-label="Live camera feed; tap a detected object to capture it"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-auto w-full"
          aria-label="Live camera feed"
        />
        <canvas
          ref={boxRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {status !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-xs text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-tier1" aria-hidden="true" />
            {status === "loading-model"
              ? "Loading on-device vision model (first time only)…"
              : "Starting camera…"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-muted">
          {status === "running"
            ? detections.length > 1
              ? `${detections.length} objects detected — tap a box to capture that item`
              : detections.length === 1
                ? "1 object detected — tap to capture"
                : "Frame the item, then tap Capture. Labels are generic hints."
            : "…"}
        </p>
        {status === "running" && (
          <button
            type="button"
            onClick={handleCaptureClick}
            className="rounded-xl bg-tier1 px-4 py-2 text-sm font-bold text-paper shadow-[0_4px_16px_rgba(127,209,160,0.25)] hover:opacity-90"
          >
            Capture frame
          </button>
        )}
      </div>
    </div>
  );
}