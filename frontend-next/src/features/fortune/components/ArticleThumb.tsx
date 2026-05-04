interface ArticleThumbProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

/**
 * 기사 카드용 썸네일. image_url 있으면 <img> 로 노출,
 * 없으면 SEDAILY 워드마크가 박힌 기본 플레이스홀더 렌더.
 */
export function ArticleThumb({ src, alt = '', className = '' }: ArticleThumbProps) {
  const baseClasses =
    'w-[72px] sm:w-[88px] h-[44px] sm:h-[54px] rounded-md border border-gray-100 dark:border-gray-800 shrink-0';

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${baseClasses} object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${baseClasses} relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 88 54"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="thumb-line" x1="0" y1="0" x2="88" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-gray-400 dark:text-gray-500">
          <rect x="10" y="14" width="36" height="3" rx="1.5" fill="url(#thumb-line)" />
          <rect x="10" y="22" width="48" height="3" rx="1.5" fill="url(#thumb-line)" />
          <rect x="10" y="30" width="28" height="3" rx="1.5" fill="url(#thumb-line)" />
        </g>
        <text
          x="44"
          y="48"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          letterSpacing="1.2"
          className="fill-gray-400 dark:fill-gray-500"
        >
          SEDAILY
        </text>
      </svg>
    </div>
  );
}
