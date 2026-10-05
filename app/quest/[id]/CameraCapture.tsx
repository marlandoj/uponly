"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Longest edge of the captured photo; keeps uploads well under the 10 MB bucket limit.
const MAX_EDGE = 1600;

type Props = {
  label: string;
  disabled?: boolean;
  onCapture: (photo: Blob) => Promise<void>;
};

/**
 * Camera-only capture: live getUserMedia preview → canvas → JPEG. There is
 * deliberately no file picker, so photos can't come from the gallery. Canvas
 * re-encoding also drops all EXIF (GPS, device) before the bytes leave the phone.
 */
export default function CameraCapture({ label, disabled, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

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

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setState("busy");
    setError(null);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Couldn't capture the photo.");
      await onCapture(blob);
      stop();
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setState("live");
    }
  }

  return (
    <div className="camera">
      <video
        ref={videoRef}
        playsInline
        muted
        className={state === "live" || state === "busy" ? "" : "hidden"}
      />
      {state === "live" || state === "busy" ? (
        <button type="button" onClick={snap} disabled={state === "busy"}>
          {state === "busy" ? "Uploading…" : "📸 Snap"}
        </button>
      ) : (
        <button type="button" onClick={start} disabled={disabled || state === "starting"}>
          {state === "starting" ? "Opening camera…" : label}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
