import type { CheckId, Gap } from '@askwell/rules';
import { useState, type MouseEvent } from 'react';
import { Mark } from '@/components/Mark';
import type { ImproveRequest, ImproveResponse } from '@/lib/improve/contract';
import { saveToLibrary } from '@/lib/settings';
import { ImproveView, type ImproveState } from './ImproveView';
import { LibraryView } from './LibraryView';

const LABELS: Record<CheckId, string> = {
  assumedMemory: 'Assumed memory',
  context: 'Context',
  goal: 'Goal',
  constraints: 'Constraints',
  output: 'Output',
  custom: 'Your rule',
};

/** Custom gaps share the id "custom"; their rule name tells them apart. */
export const gapKey = (gap: Gap): string => (gap.id === 'custom' ? `custom:${gap.title ?? ''}` : gap.id);

/**
 * The panel lives on the chat site's page, whose scripts can dispatch fake
 * clicks into it. Anything that spends the user's API key or changes their
 * prompt only answers a real click.
 */
export const realClick =
  (handler: () => void) =>
  (event: MouseEvent): void => {
    if (event.nativeEvent.isTrusted) handler();
  };

/** The feature list promises at most two at a time; the rest wait behind a button. */
const SHOWN = 2;

interface Props {
  /** The panel never grows past this; the list between header and footer scrolls instead. */
  maxHeight: number;
  draft: string;
  gaps: Gap[];
  onClose: () => void;
  onMute: (key: string) => void;
  onApply: (text: string) => void;
}

const buttonGhost = 'h-9 cursor-pointer rounded-lg border border-edge px-3.5 text-[13px] text-muted hover:bg-raised';
const buttonPrimary = 'h-9 cursor-pointer rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent disabled:opacity-50';

export function Panel({ maxHeight, draft, gaps, onClose, onMute, onApply }: Props) {
  const [tab, setTab] = useState<'gaps' | 'improve' | 'library'>('gaps');
  const [savedRewrite, setSavedRewrite] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [improve, setImprove] = useState<ImproveState>({ status: 'idle' });
  const visible = showAll ? gaps : gaps.slice(0, SHOWN);

  const runImprove = async () => {
    setTab('improve');
    setSavedRewrite(false);
    setImprove({ status: 'loading' });
    const request: ImproveRequest = { type: 'improve', prompt: draft, gaps };
    try {
      const response = (await browser.runtime.sendMessage(request)) as ImproveResponse;
      setImprove(
        response.ok
          ? { status: 'done', improvement: response.improvement, model: response.model, draft }
          : { status: 'error', error: response.error, needsKey: Boolean(response.needsKey), detail: response.detail },
      );
    } catch {
      // The extension was reloaded under this page; its old scripts can't reach the new worker.
      setImprove({ status: 'error', error: 'Preflight was updated. Reload this page to use Improve.', needsKey: false });
    }
  };

  const openTab = (id: 'gaps' | 'improve' | 'library') => {
    if (id === 'improve' && improve.status === 'idle') void runImprove();
    else setTab(id);
  };

  return (
    <section
      aria-label="Preflight"
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      style={{ maxHeight }}
      className="flex w-[440px] flex-col overflow-hidden rounded-[14px] border border-edge bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <header className="flex shrink-0 items-center justify-between py-3 pr-3 pl-4">
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

      <div role="tablist" className="flex shrink-0 gap-5 border-b border-edge px-4">
        {(['gaps', 'improve', 'library'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={realClick(() => openTab(id))}
            className={`h-9 cursor-pointer border-b-2 text-[13px] ${
              tab === id ? 'border-accent font-medium text-ink' : 'border-transparent text-subtle'
            }`}
          >
            {id === 'gaps' ? 'Gaps' : id === 'improve' ? 'Improve' : 'Library'}
          </button>
        ))}
      </div>

      {/* Only this part scrolls; header, tabs and buttons stay in place. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'gaps' ? (
          <div>
            {gaps.length === 0 && (
              <p className="p-4 text-sm text-muted">Nothing missing. This prompt says what it needs to.</p>
            )}
            {visible.map((gap, i) => (
              <article key={gapKey(gap)} className="flex flex-col gap-2 border-edge p-4 [&+&]:border-t">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.08em] text-subtle uppercase">
                    {String(i + 1).padStart(2, '0')} · {gap.title ? `${LABELS.custom} · ${gap.title}` : LABELS[gap.id]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMute(gapKey(gap))}
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
        ) : tab === 'improve' ? (
          <ImproveView state={improve} draft={draft} onRetry={realClick(() => void runImprove())} />
        ) : (
          <LibraryView draft={draft} onInsert={onApply} />
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-edge bg-canvas/40 px-4 py-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-subtle">
          {tab === 'improve' && improve.status === 'done' ? (
            `${improve.model} · your key`
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Checked locally
            </>
          )}
        </span>
        <div className="flex gap-2">
          {tab === 'gaps' && (
            <>
              <button type="button" onClick={onClose} className={buttonGhost}>
                Dismiss
              </button>
              <button type="button" onClick={realClick(() => void runImprove())} className={buttonPrimary}>
                Improve with AI
              </button>
            </>
          )}
          {tab === 'improve' && improve.status === 'error' && (
            <>
              {!improve.needsKey && (
                <button type="button" onClick={realClick(() => void runImprove())} className={buttonGhost}>
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => void browser.runtime.sendMessage({ type: 'open-settings' })}
                className={improve.needsKey ? buttonPrimary : buttonGhost}
              >
                Open settings
              </button>
            </>
          )}
          {tab === 'improve' && improve.status === 'done' && (
            <>
              <button
                type="button"
                disabled={savedRewrite}
                onClick={realClick(() => {
                  void saveToLibrary(improve.improvement.rewrite);
                  setSavedRewrite(true);
                })}
                className={`${buttonGhost} disabled:cursor-default disabled:opacity-50`}
              >
                {savedRewrite ? 'Saved' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImprove({ status: 'idle' });
                  setTab('gaps');
                }}
                className={buttonGhost}
              >
                Discard
              </button>
              <button type="button" onClick={realClick(() => onApply(improve.improvement.rewrite))} className={buttonPrimary}>
                Apply to chat
              </button>
            </>
          )}
          {tab === 'improve' && improve.status === 'loading' && (
            <button type="button" disabled className={buttonPrimary}>
              Apply to chat
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
