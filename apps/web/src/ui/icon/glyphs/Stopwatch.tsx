import type { GlyphProps } from '../index';

export function Stopwatch({ size, strokeWidth }: GlyphProps) {
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
      <path d="M5 13C5 13.9193 5.18106 14.8295 5.53284 15.6788C5.88463 16.5281 6.40024 17.2997 7.05025 17.9497C7.70026 18.5998 8.47194 19.1154 9.32122 19.4672C10.1705 19.8189 11.0807 20 12 20C12.9193 20 13.8295 19.8189 14.6788 19.4672C15.5281 19.1154 16.2997 18.5998 16.9497 17.9497C17.5998 17.2997 18.1154 16.5281 18.4672 15.6788C18.8189 14.8295 19 13.9193 19 13C19 11.1435 18.2625 9.36301 16.9497 8.05025C15.637 6.7375 13.8565 6 12 6C10.1435 6 8.36301 6.7375 7.05025 8.05025C5.7375 9.36301 5 11.1435 5 13Z" />
      <path d="M14.5 10.5L12 13" />
      <path d="M17 8L18 7" />
      <path d="M14 3H10" />
    </svg>
  );
}
