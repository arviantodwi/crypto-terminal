import Image from 'next/image';
import { Price } from '@/ui/Price';
import { PriceChange } from '@/ui/PriceChange';

export interface TickerProps {
  logo?: string;
  name: string;
  price: number;
  priceChange: number;
  symbol: string;
}

export function Ticker({ logo, name, price, priceChange, symbol }: TickerProps) {
  return (
    <div className="flex flex-col gap-0.5 not-last:border-border not-last:border-b pt-2.5 pr-3 pb-1.5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
          <span className="font-extrabold font-mono text-text uppercase">{symbol}</span>
          <span className="truncate font-medium font-sans text-text-muted">{name}</span>
        </div>
        {logo ? (
          <Image
            alt={`${symbol} logo`}
            className="shrink-0 rounded-sm"
            height={16}
            src={logo}
            width={16}
          />
        ) : (
          <span className="size-4 shrink-0 rounded-sm bg-neutral-300" />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Price value={price} />
        <PriceChange value={priceChange} />
      </div>
    </div>
  );
}
