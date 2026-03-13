import type { GlyphProps } from '../index';

export function Reload({ size, strokeWidth }: GlyphProps) {
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
      <path d="M19.933 13.041C19.7442 14.4809 19.1669 15.8423 18.2632 16.9792C17.3594 18.116 16.1633 18.9853 14.803 19.494C13.4427 20.0027 11.9696 20.1315 10.5417 19.8666C9.11374 19.6017 7.78486 18.953 6.69755 17.9903C5.61024 17.0275 4.80551 15.787 4.36967 14.4016C3.93383 13.0163 3.88332 11.5384 4.22355 10.1266C4.56379 8.7147 5.28194 7.42208 6.30097 6.38734C7.32001 5.3526 8.6015 4.61477 10.008 4.25298C13.907 3.25298 17.943 5.25998 19.433 8.99998" />
      <path d="M20 4V9H15" />
    </svg>
  );
}
