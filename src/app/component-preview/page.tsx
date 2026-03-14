import type { GlyphComponent } from '@/ui/icon';
import {
  ExternalLinkFilled,
  Icon,
  LayoutDashboard,
  LayoutDashboardFilled,
  Reload,
  Settings,
  SettingsFilled,
  SquareRoundedArrowDownFilled,
  SquareRoundedArrowUpFilled,
  SquareRoundedRotatedMinusFilled,
  Stopwatch,
  TrendingDown,
  TrendingUp,
  TriangleUpDown,
  TriangleUpDownFilled,
} from '@/ui/icon';
import { Price } from '@/ui/Price';
import { PriceChange } from '@/ui/PriceChange';

const SIZES = [24, 20, 16, 14, 12] as const;

const GLYPHS: { glyph: GlyphComponent; name: string }[] = [
  { glyph: LayoutDashboard, name: 'LayoutDashboard' },
  { glyph: LayoutDashboardFilled, name: 'LayoutDashboardFilled' },
  { glyph: ExternalLinkFilled, name: 'ExternalLinkFilled' },
  { glyph: Reload, name: 'Reload' },
  { glyph: Settings, name: 'Settings' },
  { glyph: SettingsFilled, name: 'SettingsFilled' },
  { glyph: Stopwatch, name: 'Stopwatch' },
  { glyph: TrendingUp, name: 'TrendingUp' },
  { glyph: TrendingDown, name: 'TrendingDown' },
  { glyph: TriangleUpDown, name: 'TriangleUpDown' },
  { glyph: TriangleUpDownFilled, name: 'TriangleUpDownFilled' },
  { glyph: SquareRoundedArrowUpFilled, name: 'SquareRoundedArrowUpFilled' },
  { glyph: SquareRoundedArrowDownFilled, name: 'SquareRoundedArrowDownFilled' },
  { glyph: SquareRoundedRotatedMinusFilled, name: 'SquareRoundedRotatedMinusFilled' },
];

export default function ComponentPreview() {
  return (
    <div className="min-h-screen bg-bg p-12 font-sans text-text">
      <h1 className="mb-8 font-semibold text-xl">Icon Review</h1>

      <div className="mb-3 grid grid-cols-[220px_repeat(5,56px)] items-center gap-2 text-text-muted text-xs">
        <span>Glyph</span>
        {SIZES.map(s => (
          <span className="text-center" key={s}>
            {s}px
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {GLYPHS.map(({ glyph, name }) => (
          <div
            className="grid grid-cols-[220px_repeat(5,56px)] items-center gap-2 rounded-md px-2 py-2 hover:bg-neutral-900"
            key={name}
          >
            <span className="font-mono text-text-muted text-xs">{name}</span>
            {SIZES.map(size => (
              <div className="flex items-center justify-center" key={size}>
                <Icon glyph={glyph} size={size} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <h1 className="mt-16 mb-8 font-semibold text-xl">Price Review</h1>

      <div className="flex flex-col gap-4">
        {(['sm', 'md', 'xl'] as const).map(size => (
          <div className="flex items-center gap-8" key={size}>
            <span className="w-20 font-mono text-text-muted text-xs">{size}</span>
            <Price size={size} value={12345.0} />
            <Price dimmedDecimal={false} size={size} value={12345.0} />
          </div>
        ))}
      </div>

      <h1 className="mt-16 mb-8 font-semibold text-xl">Price Change Review</h1>

      <div className="flex items-center gap-8">
        <PriceChange value={2.4} />
        <PriceChange value={-2.4} />
      </div>
    </div>
  );
}
