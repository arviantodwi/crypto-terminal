---
paths:
  - "apps/web/**"
---

# Styling System

## Tailwind v4 CSS-First Config

- No `tailwind.config.ts`. All theme customization is in the `@theme inline {}` block in `src/app/globals.css`.
- Design tokens sourced from the Figma Dark Color Palette: 5 color scales (neutral, yellow, green, red, blue) with shades 50–950, plus semantic aliases (`--color-bg`, `--color-text`, `--color-text-muted`, `--color-border`).
- Currently dark-only. The `:root` and `@media (prefers-color-scheme: dark)` blocks both use the same dark token values. The media query is preserved for future light theme support.

## Typography

- Font stack: Space Grotesk (`font-sans`) + JetBrains Mono (`font-mono`), loaded via `next/font/google` in `layout.tsx`.
- Slashed zero (`"zero"`) is enabled globally via `font-feature-settings`.

## Tailwind Variants

Always use `tailwind-variants` (`tv`) for component styling. Do not use plain `clsx`/`cx` for conditional classes in components.
