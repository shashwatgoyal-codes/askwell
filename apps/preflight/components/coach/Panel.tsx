import type { CheckId, Gap } from '@askwell/rules';
import { useState } from 'react';
import { Mark } from '@/components/Mark';

const LABELS: Record<CheckId, string> = {
  assumedMemory: 'Assumed memory',
  context: 'Context',
  goal: 'Goal',
  constraints: 'Constraints',
  output: 'Output',
};

/** The feature list promises at most two at a time; the rest wait behind a button. */
const SHOWN = 2;

interface Props {
  gaps: Gap[];
  onClose: () => void;
  onMute: (id: CheckId) => void;
}

export function Panel({ gaps, onClose, onMute }: Props) {
  const [tab, setTab] = useState<'gaps' | 'improve'>('gaps');
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? gaps : gaps.slice(0, SHOWN);

  return (
    <section
      aria-label="Preflight"
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className="w-[420px] overflow-hidden rounded-[14px] border border-edge bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <header className="flex items-center justify-between py-3 pr-3 pl-4">
        <div className="flex items-center gap-2.5">
          <Mark size={22} />
          <span className="text-sm font-medium">Preflight</span>
          {gaps.length > 0 && (
            <span className="font-mono text-xs text-accent">
              {gaps.length} {gaps.length === 1 ? 'gap' : 'gaps'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-subtle hover:bg-raised"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div role="tablist" className="flex gap-5 border-b border-edge px-4">
        {(['gaps', 'improve'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-9 cursor-pointer border-b-2 text-[13px] ${
              tab === id ? 'border-accent font-medium text-ink' : 'border-transparent text-subtle'
            }`}
          >
            {id === 'gaps' ? 'Gaps' : 'Improve'}
          </button>
        ))}
      </div>

      {tab === 'gaps' ? (
        <div>
          {gaps.length === 0 && (
            <p className="p-4 text-sm text-muted">Nothing missing. This prompt says what it needs to.</p>
          )}
          {visible.map((gap, i) => (
            <article key={gap.id} className="flex flex-col gap-2 border-edge p-4 [&+&]:border-t">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.08em] text-subtle uppercase">
                  {String(i + 1).padStart(2, '0')} · {LABELS[gap.id]}
                </span>
                <button
                  type="button"
                  onClick={() => onMute(gap.id)}
                  className="cursor-pointer rounded px-1.5 py-1 text-xs text-subtle hover:bg-raised"
                >
                  Mute
                </button>
              </div>
              <p className="text-sm leading-normal">{gap.message}</p>
              <p className="text-[13px] leading-normal text-muted">{gap.hint}</p>
            </article>
          ))}
          {!showAll && gaps.length > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full cursor-pointer border-t border-edge py-2.5 text-[13px] text-muted hover:bg-raised"
            >
              Show {gaps.length - SHOWN} more
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm leading-normal">
            Improve rewrites this prompt with your own API key and shows every change, with the reason for it.
          </p>
          <p className="text-[13px] leading-normal text-muted">No key is set up yet.</p>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-edge bg-canvas/40 px-4 py-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-subtle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Checked locally
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-lg border border-edge px-3.5 text-[13px] text-muted hover:bg-raised"
          >
            Dismiss
          </button>
          {tab === 'gaps' ? (
            <button
              type="button"
              onClick={() => setTab('improve')}
              className="h-9 cursor-pointer rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent"
            >
              Improve with AI
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void browser.runtime.sendMessage({ type: 'open-settings' })}
              className="h-9 cursor-pointer rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent"
            >
              Add a key in settings
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
