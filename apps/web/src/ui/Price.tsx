import { cn, tv, type VariantProps } from 'tailwind-variants';

const priceVariants = tv({
  base: 'inline-flex items-baseline font-sans text-text',
  defaultVariants: {
    size: 'md',
  },
  variants: {
    size: {
      md: 'text-base',
      sm: 'text-sm',
      xl: 'text-2xl',
    },
  },
});

type PriceVariants = VariantProps<typeof priceVariants>;

interface PriceProps extends PriceVariants {
  className?: string;
  currency?: string;
  decimals?: number;
  dimmedDecimal?: boolean;
  value: number;
}

export function Price({
  className,
  currency = '$',
  decimals = 2,
  dimmedDecimal = true,
  size,
  value,
}: PriceProps) {
  const [intStr, decStr] = value.toFixed(decimals).split('.');
  const formattedInt = new Intl.NumberFormat().format(Number(intStr));

  return (
    <span className={priceVariants({ className, size })}>
      <span className="font-normal opacity-80">{currency}</span>
      <span className="font-bold">{formattedInt}</span>
      <span className={cn(dimmedDecimal ? 'opacity-40' : undefined, 'font-medium')}>
        <span>.</span>
        <span>{decStr}</span>
      </span>
    </span>
  );
}

export type { PriceProps };
