---
paths:
  - "apps/web/**"
---

# Icon System

Location: `src/ui/icon/`

- `index.tsx` — `Icon` component + re-exports all glyphs. Uses `tailwind-variants` (`tv`) for size variants: `16` (default) / `14` / `20` / `24`. Stroke weight is derived automatically from size.
- `glyphs/` — one file per glyph.

## Glyph Patterns

**Stroke glyphs:**
- Receive `{ size, strokeWidth }`
- Render `<svg fill="none" stroke="currentColor" strokeWidth={strokeWidth}>`
- No `Filled` suffix in name

**Fill glyphs:**
- Receive `{ size }` (strokeWidth optional and ignored)
- Render `<svg fill="currentColor">`
- Must have `Filled` suffix in both filename and exported function name

All SVGs must have `aria-hidden="true"` (icons are decorative; surrounding context provides the accessible label).

## Usage

```tsx
<Icon glyph={Settings} size={20} />
<Icon glyph={SettingsFilled} className="text-yellow-400" />
```
