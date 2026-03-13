import type { GlyphProps } from '../index';

export function TriangleUpDown({ size, strokeWidth }: GlyphProps) {
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
      <path d="M15.2592 9.35938L9.37961 3.5L3.5 9.35938H15.2592Z" />
      <path d="M20.5 14.6406L14.6211 20.5L8.74219 14.6406H20.5Z" />
    </svg>
  );
}
