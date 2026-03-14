import { tv, type VariantProps } from 'tailwind-variants';

export interface GlyphProps {
  size: 24 | 20 | 16 | 14 | 12;
  strokeWidth?: number;
}

export type GlyphComponent = React.ComponentType<GlyphProps>;

const strokeWeightMap = {
  12: 1.25,
  14: 1.25,
  16: 1.5,
  20: 1.75,
  24: 2,
} as const;

const iconVariants = tv({
  base: 'inline-flex shrink-0',
  defaultVariants: {
    size: 16,
  },
  variants: {
    size: {
      12: 'size-3',
      14: 'size-3.5',
      16: 'size-4',
      20: 'size-5',
      24: 'size-6',
    },
  },
});

type IconVariants = VariantProps<typeof iconVariants>;

interface IconProps extends IconVariants {
  className?: string;
  glyph: GlyphComponent;
}

export function Icon({ glyph: Glyph, size, className }: IconProps) {
  const resolvedSize = (size ?? 16) as keyof typeof strokeWeightMap;
  return (
    <span className={iconVariants({ className, size })}>
      <Glyph size={resolvedSize} strokeWidth={strokeWeightMap[resolvedSize]} />
    </span>
  );
}

export { iconVariants };
export type { IconProps };

// Glyph re-exports
export { ExternalLinkFilled } from './glyphs/ExternalLinkFilled';
export { LayoutDashboard } from './glyphs/LayoutDashboard';
export { LayoutDashboardFilled } from './glyphs/LayoutDashboardFilled';
export { Reload } from './glyphs/Reload';
export { Settings } from './glyphs/Settings';
export { SettingsFilled } from './glyphs/SettingsFilled';
export { SquareRoundedArrowDownFilled } from './glyphs/SquareRoundedArrowDownFilled';
export { SquareRoundedArrowUpFilled } from './glyphs/SquareRoundedArrowUpFilled';
export { SquareRoundedRotatedMinusFilled } from './glyphs/SquareRoundedRotatedMinusFilled';
export { Stopwatch } from './glyphs/Stopwatch';
export { TrendingDown } from './glyphs/TrendingDown';
export { TrendingUp } from './glyphs/TrendingUp';
export { TriangleUpDown } from './glyphs/TriangleUpDown';
export { TriangleUpDownFilled } from './glyphs/TriangleUpDownFilled';
