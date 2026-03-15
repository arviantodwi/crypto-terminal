'use client';

import Image from 'next/image';
import {
  LayoutDashboard,
  LayoutDashboardFilled,
  Settings,
  SettingsFilled,
  TriangleUpDown,
  TriangleUpDownFilled,
} from '@/ui/icon';
import { NavItem, type NavItemProps } from './components/NavItem';
import { SectionHeader } from './components/SectionHeader';
import { Ticker, type TickerProps } from './components/Ticker';
import { WatchlistEmpty } from './components/WatchlistEmpty';

const PRIMARY_NAV_ITEMS: NavItemProps[] = [
  { activeGlyph: LayoutDashboardFilled, glyph: LayoutDashboard, href: '/', label: 'Dashboard' },
  { activeGlyph: TriangleUpDownFilled, glyph: TriangleUpDown, href: '/trades', label: 'Trade Log' },
] as const;

const PREFERENCES_NAV_ITEMS: NavItemProps[] = [
  { activeGlyph: SettingsFilled, glyph: Settings, href: '/settings', label: 'Settings' },
];

const TICKERS: TickerProps[] = [
  {
    logo: 'https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png',
    name: 'Bitcoin',
    price: 84234.56,
    priceChange: 2.44,
    symbol: 'BTC',
  },
  {
    logo: 'https://coin-images.coingecko.com/coins/images/279/thumb/ethereum.png',
    name: 'Ethereum',
    price: 1982.11,
    priceChange: -1.12,
    symbol: 'ETH',
  },
  {
    logo: 'https://coin-images.coingecko.com/coins/images/4128/thumb/solana.png',
    name: 'Solana',
    price: 128.45,
    priceChange: 5.38,
    symbol: 'SOL',
  },
  {
    logo: 'https://coin-images.coingecko.com/coins/images/10365/thumb/near.jpg',
    name: 'Near Protocol',
    price: 1.56,
    priceChange: 0.96,
    symbol: 'NEAR',
  },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-52.5 flex-col border-border border-r bg-bg">
      <div className="flex items-center gap-2 border-border border-b px-4 py-6">
        <Image
          alt="Phantom Terminal Logo"
          className="shrink-0"
          height={38}
          src="/logo.svg"
          width={34}
        />
        <span className="font-bold font-mono text-sm text-text uppercase leading-tight tracking-[2px]">
          PHANTOM TERMINAL
        </span>
      </div>

      <nav className="flex flex-col gap-1.5 pt-5 pb-2">
        <SectionHeader title="Navigation" />
        {PRIMARY_NAV_ITEMS.map(item => (
          <NavItem {...item} key={item.href} />
        ))}
      </nav>

      <div className="mb-5 flex flex-1 flex-col overflow-y-auto">
        <div className="sticky inset-y-0 top-0 z-2 bg-bg py-2">
          <SectionHeader title="Watchlist" />
        </div>
        {TICKERS.length === 0 ? (
          <WatchlistEmpty />
        ) : (
          <div className="pl-5.5">
            {TICKERS.map(ticker => (
              <Ticker key={ticker.symbol} {...ticker} />
            ))}
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-1.5 py-2">
        <SectionHeader title="Preferences" />
        {PREFERENCES_NAV_ITEMS.map(item => (
          <NavItem {...item} key={item.href} />
        ))}
      </nav>
    </aside>
  );
}
