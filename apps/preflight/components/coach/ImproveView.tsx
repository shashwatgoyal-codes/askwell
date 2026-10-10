import type { Improvement } from '@/lib/improve/contract';

const KIND_LABEL: Record<Improvement['changes'][number]['kind'], string> = {
  assumedMemory: 'Context',
  context: 'Context',
  goal: 'Goal',
  constraints: 'Limits',
  output: 'Output',
  clarity: 'Clarity',
};

export type ImproveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string; needsKey: boolean; detail?: string }
  | { status: 'done'; improvement: Improvement; model: string; draft: string };

/** Split the rewrite into plain and added runs, using the exact spans the model reported. */
export function highlight(rewrite: string, added: string[]): { text: string; added: boolean }[] {
  const ranges: [number, number][] = [];
  let from = 0;
  for (const piece of added) {
    if (!piece.trim()) continue;
    let at = rewrite.indexOf(piece, from);
    if (at < 0) at = rewrite.indexOf(piece);
    if (at < 0) continue;
    ranges.push([at, at + piece.length]);
    from = at + piece.length;
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const runs: { text: string; added: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue; // overlapping span; keep the first
    if (start > cursor) runs.push({ text: rewrite.slice(cursor, start), added: false });
    runs.push({ text: rewrite.slice(start, end), added: true });
    cursor = end;
  }
  if (cursor < rewrite.length) runs.push({ text: rewrite.slice(cursor), added: false });
  return runs;
}

interface Props {
  state: ImproveState;
  draft: string;
  onRetry: () => void;
}

export function ImproveView({ state, draft, onRetry }: Props) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="flex items-center gap-2.5 p-4 text-sm text-muted" role="status">
        <span className="size-3.5 animate-spin rounded-full border-2 border-edge border-t-accent" />
        Rewriting with your key…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm leading-normal">{state.error}</p>
        {state.detail && (
          <p className="rounded-lg border border-edge bg-canvas/50 px-2.5 py-2 font-mono text-[11.5px] leading-normal break-words text-subtle">
            {state.detail}
          </p>
        )}
        <p className="text-[13px] leading-normal text-muted">
          {state.needsKey
            ? 'Improve uses your own API key, set in Preflight’s settings.'
            : 'Nothing was changed in your prompt.'}
        </p>
      </div>
    );
  }

  const { improvement } = state;
  const runs = highlight(improvement.rewrite, improvement.changes.map((change) => change.added));
  const stale = state.draft.trim() !== draft.trim();

  return (
    <div>
      <div className="flex flex-col gap-1.5 px-4 pt-4">
        <span className="font-mono text-[11px] tracking-[0.08em] text-subtle">BEFORE</span>
        <p className="max-h-24 overflow-auto text-sm leading-relaxed whitespace-pre-wrap text-subtle line-through">
          {state.draft}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
        <span className="font-mono text-[11px] tracking-[0.08em] text-subtle">AFTER</span>
        <p className="max-h-48 overflow-auto text-sm leading-[1.75] whitespace-pre-wrap">
          {runs.map((run, i) =>
            run.added ? (
              <mark key={i} className="rounded-[3px] border-b-[1.5px] border-accent bg-wash px-0.5 text-ink">
                {run.text}
              </mark>
            ) : (
              <span key={i}>{run.text}</span>
            ),
          )}
        </p>
      </div>
      {improvement.changes.length > 0 && (
        <ul className="flex flex-col border-t border-edge px-4 py-1.5">
          {improvement.changes.map((change, i) => (
            <li key={i} className="flex items-baseline gap-3 py-1.5">
              <span className="w-[84px] shrink-0 font-mono text-[11px] tracking-[0.08em] text-accent uppercase">
                + {KIND_LABEL[change.kind]}
              </span>
              <span className="text-[13px] leading-snug text-muted">{change.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {stale && (
        <div className="flex items-center justify-between gap-3 border-t border-edge px-4 py-2.5">
          <span className="text-[13px] text-muted">Your prompt changed after this rewrite.</span>
          <button type="button" onClick={onRetry} className="cursor-pointer text-[13px] font-medium text-accent">
            Rewrite again
          </button>
        </div>
      )}
    </div>
  );
}
