import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, tv } from 'tailwind-variants';
import { type GlyphComponent, Icon } from '@/ui/icon';

const navItemVariants = tv({
  base: 'flex w-full items-center gap-3 pl-2 pr-4 py-2.5 transition-colors',
  defaultVariants: {
    isActive: false,
  },
  variants: {
    isActive: {
      false: 'bg-transparent text-neutral-500 hover:text-neutral-300 font-medium',
      true: 'bg-yellow-950 text-yellow-50 font-bold',
    },
  },
});

export interface NavItemProps {
  activeGlyph: GlyphComponent;
  glyph: GlyphComponent;
  href: string;
  label: string;
}

export function NavItem({ activeGlyph, glyph, href, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const _glyph = isActive ? activeGlyph : glyph;

  return (
    <Link className={navItemVariants({ isActive })} href={href}>
      <span className={cn('h-4 w-0.75 shrink-0', isActive ? 'bg-yellow-400' : 'bg-transparent')} />
      <Icon glyph={_glyph} size={16} />
      <span className="font-mono text-xs uppercase">{label}</span>
    </Link>
  );
}
