import Image from "next/image";

/** Decorative pixel-art sprite (see lib/sprite.ts). Lazy unless `priority` (eager, high fetch priority). */
export default function Sprite({
  src,
  size,
  priority = false,
  className = "",
}: {
  src: string;
  size: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      className={`sprite ${className}`.trim()}
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      sizes={`${size}px`}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
