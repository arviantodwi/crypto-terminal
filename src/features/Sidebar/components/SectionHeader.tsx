interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-1.5 pr-4 pl-1 font-bold font-mono text-[10px] text-neutral-500 leading-none">
      <span>{'//'}</span>
      <span className="uppercase">{title}</span>
    </div>
  );
}
