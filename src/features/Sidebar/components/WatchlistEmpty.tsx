import { tv } from 'tailwind-variants';

const skeletonRowVariants = tv({
  base: 'flex flex-col gap-1.5 py-2.5',
  defaultVariants: { hasBorder: false },
  variants: {
    hasBorder: {
      false: '',
      true: 'border-b border-border',
    },
  },
});

function SkeletonRow({ hasBorder = false }: { hasBorder?: boolean }) {
  return (
    <div className={skeletonRowVariants({ hasBorder })}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded-sm bg-neutral-700" />
        <div className="size-4 rounded-sm bg-neutral-700" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-22 rounded-sm bg-neutral-700" />
        <div className="h-4 w-10.75 rounded-sm bg-neutral-700" />
      </div>
    </div>
  );
}

export function WatchlistEmpty() {
  return (
    <div className="px-3 py-2">
      <div className="blur-xs">
        <SkeletonRow hasBorder />
        <SkeletonRow />
      </div>
      <div className="mt-1.5 flex flex-col gap-1 px-1 pt-0.5 pb-2 text-center">
        <p className="font-bold font-sans text-sm text-text">Your watchlist is empty</p>
        <p className="font-medium font-sans text-[11px] text-neutral-500">
          Start building your watchlist by adding crypto from the Terminal
        </p>
      </div>
    </div>
  );
}
