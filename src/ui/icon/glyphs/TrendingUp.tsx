import type { GlyphProps } from '../index';

export function TrendingUp({ size, strokeWidth }: GlyphProps) {
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
      <path d="M3 17L9 11L13 15L21 7" />
      <path d="M14 7H21V14" />
    </svg>
  );
}
