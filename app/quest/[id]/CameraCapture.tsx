"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EVIDENCE_ACCEPT } from "@/lib/evidence";

// Longest edge of the captured photo; keeps uploads well under the 10 MB bucket limit.
const MAX_EDGE = 1600;
// Clip length cap and bitrate keep recordings well under the 50 MB bucket limit.
const MAX_CLIP_SECONDS = 20;
const CLIP_BITRATE = 2_500_000;

type Props = {
  label: string;
  /** Shown while onCapture is pending (defaults to "Uploading…"). */
  busyLabel?: string;
  disabled?: boolean;
  onCapture: (evidence: Blob) => Promise<void>;
};

/** First recorder format the browser supports and the upload route accepts (Safari: mp4, Chrome: webm). */
function clipMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const accepted = EVIDENCE_ACCEPT.split(",").filter((t) => t.startsWith("video/"));
  return accepted.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * Camera-only capture: live getUserMedia preview → canvas → JPEG, or a short
 * MediaRecorder clip (MP4/WebM, no audio). There is deliberately no file
 * picker, so evidence can't come from the gallery. Canvas re-encoding drops
 * all EXIF (GPS, device) before photo bytes leave the phone; live recordings
 * carry no location metadata.
 */
export default function CameraCapture({ label, busyLabel = "Uploading…", disabled, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "recording" | "busy">("idle");
  const [mode, setMode] = useState<"photo" | "clip">("photo");
  const [clipType, setClipType] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const finishClip = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);
  useEffect(() => setClipType(clipMimeType()), []);

  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = Date.now();
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setRecorded(s);
      if (s >= MAX_CLIP_SECONDS) finishClip();
    }, 250);
    return () => clearInterval(t);
  }, [state, finishClip]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera. Try Safari or Chrome on your phone.");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setState("live");
    } catch (e) {
      stop();
      setState("idle");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access to snap your photo."
          : "Couldn't start the camera.",
      );
    }
  }

  async function upload(evidence: Blob) {
    setState("busy");
    setError(null);
    try {
      await onCapture(evidence);
      stop();
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setState("live");
    }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      setError("Couldn't capture the photo.");
      return;
    }
    await upload(blob);
  }

  function record() {
    const stream = streamRef.current;
    if (!stream || !clipType) return;
    setError(null);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: clipType, videoBitsPerSecond: CLIP_BITRATE });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      // Only upload clips that ended through Stop or the time cap, not unmount.
      if (recorderRef.current !== recorder) return;
      recorderRef.current = null;
      void upload(new Blob(chunks, { type: clipType }));
    };
    recorderRef.current = recorder;
    setRecorded(0);
    recorder.start(1000);
    setState("recording");
  }

  const live = state === "live" || state === "recording" || state === "busy";

  return (
    <div className="camera">
      {clipType && state !== "recording" && state !== "busy" && (
        <div className="capture-mode" role="radiogroup" aria-label="Evidence type">
          {(["photo", "clip"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? "on" : ""}
              onClick={() => setMode(m)}
            >
              {m === "photo" ? "📸 Photo" : `🎥 Clip ≤${MAX_CLIP_SECONDS}s`}
            </button>
          ))}
        </div>
      )}
      <video ref={videoRef} playsInline muted className={live ? "" : "hidden"} />
      {state === "recording" && (
        <p className="rec" aria-live="polite">
          ● REC {recorded}s / {MAX_CLIP_SECONDS}s
        </p>
      )}
      {!live ? (
        <button type="button" onClick={start} disabled={disabled || state === "starting"}>
          {state === "starting" ? "Opening camera…" : label}
        </button>
      ) : state === "busy" ? (
        <button type="button" disabled>{busyLabel}</button>
      ) : state === "recording" ? (
        <button type="button" onClick={finishClip}>⏹ Stop &amp; upload</button>
      ) : mode === "clip" && clipType ? (
        <button type="button" onClick={record}>⏺ Record</button>
      ) : (
        <button type="button" onClick={snap}>📸 Snap</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
