interface Props {
  count: number;
  open: boolean;
  onClick: () => void;
}

export function Badge({ count, open, onClick }: Props) {
  if (count === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Preflight: no gaps"
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-edge bg-surface px-3 font-mono text-xs text-muted shadow-sm"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        clear
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`Preflight: ${count} ${count === 1 ? 'gap' : 'gaps'} in this prompt`}
      className={`flex h-8 cursor-pointer items-center gap-2 rounded-full border bg-surface px-3 font-mono text-xs text-ink shadow-sm ${
        open ? 'border-accent' : 'border-edge'
      }`}
    >
      <span className="size-1.5 rounded-full bg-accent" />
      {count} {count === 1 ? 'gap' : 'gaps'}
    </button>
  );
}
