import type { Nudge } from '@askwell/rules';

const LABEL: Record<Nudge['id'], string> = {
  sequentialFixing: 'SEQUENTIAL FIXING',
  repeatLoop: 'REPEAT LOOP',
  contextLoss: 'CONTEXT LOSS',
  learningLoop: 'LEARNING LOOP',
};

interface Props {
  nudge: Nudge;
  width: number;
  onInsert: () => void;
  onDismiss: () => void;
}

export function NudgeCard({ nudge, width, onInsert, onDismiss }: Props) {
  return (
    <aside
      aria-label="Preflight nudge"
      style={{ width }}
      className="flex items-start gap-4 rounded-[14px] border border-edge bg-surface p-4 shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
    >
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11px] tracking-[0.08em] text-subtle">{LABEL[nudge.id]}</span>
        </div>
        <p className="text-[15px] font-medium">{nudge.title}</p>
        <p className="text-[13.5px] leading-normal text-muted">{nudge.body}</p>
      </div>
      <div className="flex shrink-0 gap-2 self-center">
        <button type="button" onClick={onDismiss} className="h-9 cursor-pointer rounded-lg px-3 text-[13px] text-muted hover:bg-raised">
          Not now
        </button>
        <button
          type="button"
          onClick={onInsert}
          className="h-9 cursor-pointer rounded-lg border border-accent/45 bg-wash px-3.5 text-[13px] font-medium text-ink"
        >
          {nudge.action}
        </button>
      </div>
    </aside>
  );
}
