---
paths:
  - "apps/web/**"
---

# Figma to Code

## Font Mapping

| Figma font | Tailwind utility |
|------------|-----------------|
| Space Grotesk | `font-sans` |
| JetBrains Mono | `font-mono` |

## Guidelines

- Always use Tailwind Variants (`tv`) when converting designs to UI components.
- Ensure the rendered UI appearance matches the Figma design as closely as possible.
- Use design tokens defined in `src/app/globals.css` for colors — do not use raw Tailwind color utilities unless they match a design token.
