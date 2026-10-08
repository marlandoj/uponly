import { isVideoPath } from "@/lib/evidence";

/** One before/after tile: a photo, or a clip with controls, from a short-lived signed URL. */
export default function Evidence({ label, src, path }: { label: string; src: string | null; path: string | null }) {
  return (
    <figure>
      {!src ? (
        <div className="photo-missing">Evidence unavailable</div>
      ) : isVideoPath(path) ? (
        <video src={src} controls playsInline preload="metadata" aria-label={`${label} clip`} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={src} alt={`${label} photo`} />
      )}
      <figcaption>
        {label}
        {isVideoPath(path) && " · 🎥 clip"}
      </figcaption>
    </figure>
  );
}
