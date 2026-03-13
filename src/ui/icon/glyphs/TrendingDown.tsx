import type { GlyphProps } from '../index';

export function TrendingDown({ size, strokeWidth }: GlyphProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M3 7L9 13L13 9L21 17" />
      <path d="M21 10V17H14" />
    </svg>
  );
}
