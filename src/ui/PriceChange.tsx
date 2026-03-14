import { tv, type VariantProps } from 'tailwind-variants';
import { Icon, TrendingDown, TrendingUp } from '@/ui/icon';

const priceChangeVariants = tv({
  base: 'inline-flex items-center gap-0.5 font-sans font-medium text-[11px]',
  defaultVariants: {
    kind: 'positive',
  },
  variants: {
    kind: {
      negative: 'text-red-500',
      positive: 'text-green-500',
    },
  },
});

type PriceChangeVariants = VariantProps<typeof priceChangeVariants>;

interface PriceChangeProps {
  className?: string;
  value: number;
}

export function PriceChange({ className, value }: PriceChangeProps) {
  const isPositive = value >= 0;
  const kind: PriceChangeVariants['kind'] = isPositive ? 'positive' : 'negative';
  const glyph = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={priceChangeVariants({ className, kind })}>
      <Icon glyph={glyph} size={12} />
      <span>{isPositive ? '+' : '-'}</span>
      <span>{Math.abs(value).toFixed(1)}</span>
      <span>%</span>
    </span>
  );
}

export type { PriceChangeProps };
