import { checkSession, runChecks, type CheckId, type Sensitivity } from '@askwell/rules';
import { useEffect, useMemo, useRef, useState } from 'react';
import { conversationCoaching, disabledChecks, disabledSites, recordSent, sensitivity } from '@/lib/settings';
import { findComposer, readText, readUserMessages, writeText, type Site } from '@/lib/sites';
import { isDarkBehind } from '@/lib/theme';
import { Badge } from './Badge';
import { NudgeCard } from './NudgeCard';
import { Panel } from './Panel';

/** How often to look for the prompt box. Sites re-render it on navigation. */
const POLL_MS = 400;

interface Anchor {
  right: number;
  bottom: number;
  width: number;
}

function useSetting<T>(item: { getValue(): Promise<T>; watch(cb: (v: T) => void): () => void }, initial: T): T {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    void item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return value;
}

export function Coach({ site }: { site: Site }) {
  const composerRef = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [text, setText] = useState('');
  const [previous, setPrevious] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState<Set<CheckId>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const level = useSetting<Sensitivity>(sensitivity, 'balanced');
  const disabled = useSetting<CheckId[]>(disabledChecks, []);
  const sitesOff = useSetting<string[]>(disabledSites, []);
  const coaching = useSetting<boolean>(conversationCoaching, true);
  const siteOff = sitesOff.includes(site.id);

  // Follow the prompt box (where it is, what it says, how dark it sits) and
  // the person's earlier messages in this chat.
  useEffect(() => {
    const sync = () => {
      const el = findComposer(site);
      composerRef.current = el;
      if (!el) {
        setAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const box = el.closest('form, fieldset, rich-textarea')?.getBoundingClientRect() ?? rect;
      const next = {
        right: Math.round(innerWidth - rect.right),
        bottom: Math.round(innerHeight - rect.top + 10),
        width: Math.round(Math.min(Math.max(box.width, 420), 680)),
      };
      setAnchor((prev) =>
        prev && prev.right === next.right && prev.bottom === next.bottom && prev.width === next.width ? prev : next,
      );
      setText(readText(el));
      setDark(isDarkBehind(el));
      const messages = readUserMessages(site);
      setPrevious((prev) => (prev.length === messages.length && prev.every((m, i) => m === messages[i]) ? prev : messages));
      setLoaded(true);
    };
    sync();
    const timer = setInterval(sync, POLL_MS);
    // Typing should update the badge at once, not on the next poll.
    const onInput = (event: Event) => {
      const el = composerRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) setText(readText(el));
    };
    document.addEventListener('input', onInput, true);
    addEventListener('resize', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('input', onInput, true);
      removeEventListener('resize', sync);
    };
  }, [site]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const gaps = useMemo(
    () => runChecks(text, { sensitivity: level, disabled }).filter((gap) => !muted.has(gap.id)),
    [text, level, disabled, muted],
  );

  // A new message of the person's appearing means the draft was sent. Count
  // it for today's stats with the gaps it still had: counts, never the text.
  const lastGaps = useRef<CheckId[]>([]);
  if (words >= 3) lastGaps.current = gaps.map((gap) => gap.id);
  // Messages already on the page when it loads were sent before; only growth
  // after the first read counts.
  const sentCount = useRef<number | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (sentCount.current !== null && previous.length > sentCount.current) {
      void recordSent(lastGaps.current);
      lastGaps.current = [];
    }
    sentCount.current = previous.length;
  }, [loaded, previous.length]);

  // An emptied box means the prompt was sent: forget what was muted for it.
  useEffect(() => {
    if (words === 0) {
      setMuted(new Set());
      setOpen(false);
    }
  }, [words]);

  const chat = location.pathname;
  const nudge = useMemo(() => {
    if (!coaching) return null;
    const found = checkSession({ previous, draft: text });
    return found && !dismissed.has(`${chat}:${found.id}`) ? found : null;
  }, [coaching, previous, text, dismissed, chat]);

  if (siteOff || !anchor || (words < 3 && !nudge)) return null;

  const put = (value: string) => {
    const el = composerRef.current;
    if (!el) return;
    writeText(el, value);
    setText(readText(el));
  };

  return (
    <div
      className={`${dark ? '' : 'pf-light'} fixed z-[2147483646] flex flex-col items-end gap-2 font-sans text-ink antialiased`}
      style={{ right: anchor.right, bottom: anchor.bottom }}
    >
      {open && (
        <Panel
          draft={text}
          gaps={gaps}
          onClose={() => setOpen(false)}
          onMute={(id) => setMuted((prev) => new Set(prev).add(id))}
          onApply={(rewrite) => {
            put(rewrite);
            setOpen(false);
          }}
        />
      )}
      {!open && nudge && (
        <NudgeCard
          nudge={nudge}
          width={anchor.width}
          onInsert={() => {
            put(nudge.template);
            setDismissed((prev) => new Set(prev).add(`${chat}:${nudge.id}`));
          }}
          onDismiss={() => setDismissed((prev) => new Set(prev).add(`${chat}:${nudge.id}`))}
        />
      )}
      {words >= 3 && <Badge count={gaps.length} open={open} onClick={() => setOpen((v) => !v)} />}
    </div>
  );
}
