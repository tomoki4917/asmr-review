import Image from "next/image";
import type { Review } from "@/lib/types";

type Props = {
  coverImage: string | undefined;
  alt: string;
  slug: string;
  priority?: boolean;
  className?: string;
};

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i) * (i + 1)) % 360;
  return h;
}

export function ReviewCoverPlaceholder({ slug, className = "" }: { slug: string; className?: string }) {
  const h = hueFromString(slug);
  const h2 = (h + 48) % 360;
  return (
    <div
      className={`absolute inset-0 ${className}`}
      aria-hidden
      style={{
        background: `linear-gradient(145deg, hsl(${h}, 42%, 28%) 0%, hsl(${h2}, 38%, 14%) 100%)`,
      }}
    >
      <div
        className="absolute -right-[12%] -top-[18%] h-[72%] w-[72%] rounded-full opacity-25 blur-3xl"
        style={{ background: `hsl(${(h + 120) % 360}, 55%, 45%)` }}
      />
      <div
        className="absolute -bottom-[14%] -left-[12%] h-[62%] w-[62%] rounded-full opacity-20 blur-3xl"
        style={{ background: `hsl(${(h + 220) % 360}, 50%, 50%)` }}
      />
    </div>
  );
}

export function ReviewCover({
  coverImage,
  alt,
  slug,
  priority = false,
  className = "",
}: Props) {
  const wrap = `relative aspect-[16/10] w-full overflow-hidden bg-stone-200 dark:bg-stone-800 ${className}`;

  if (!coverImage) {
    return (
      <div className={wrap}>
        <ReviewCoverPlaceholder slug={slug} />
      </div>
    );
  }

  const isLocal = coverImage.startsWith("/");
  const isRemote =
    coverImage.startsWith("http://") || coverImage.startsWith("https://");

  if (isLocal) {
    return (
      <div className={wrap}>
        <Image
          src={coverImage}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={priority}
        />
      </div>
    );
  }

  if (isRemote) {
    return (
      <div className={wrap}>
        <Image
          src={coverImage}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div className={wrap}>
      <ReviewCoverPlaceholder slug={slug} />
    </div>
  );
}
