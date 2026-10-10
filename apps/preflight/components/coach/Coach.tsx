import { runChecks, type CheckId, type Sensitivity } from '@askwell/rules';
import { useEffect, useMemo, useRef, useState } from 'react';
import { disabledChecks, disabledSites, sensitivity } from '@/lib/settings';
import { findComposer, readText, type Site } from '@/lib/sites';
import { isDarkBehind } from '@/lib/theme';
import { Badge } from './Badge';
import { Panel } from './Panel';

/** How often to look for the prompt box. Sites re-render it on navigation. */
const POLL_MS = 400;

interface Anchor {
  right: number;
  bottom: number;
}

export function Coach({ site }: { site: Site }) {
  const composerRef = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [text, setText] = useState('');
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState<Set<CheckId>>(new Set());

  const [level, setLevel] = useState<Sensitivity>('balanced');
  const [disabled, setDisabled] = useState<CheckId[]>([]);
  const [siteOff, setSiteOff] = useState(false);

  useEffect(() => {
    void sensitivity.getValue().then(setLevel);
    void disabledChecks.getValue().then(setDisabled);
    void disabledSites.getValue().then((ids) => setSiteOff(ids.includes(site.id)));
    const unwatch = [
      sensitivity.watch(setLevel),
      disabledChecks.watch(setDisabled),
      disabledSites.watch((ids) => setSiteOff(ids.includes(site.id))),
    ];
    return () => unwatch.forEach((stop) => stop());
  }, [site.id]);

  // Follow the prompt box: where it is, what it says, and how dark it sits.
  useEffect(() => {
    const sync = () => {
      const el = findComposer(site);
      composerRef.current = el;
      if (!el) {
        setAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const next = { right: Math.round(innerWidth - rect.right), bottom: Math.round(innerHeight - rect.top + 10) };
      setAnchor((prev) => (prev && prev.right === next.right && prev.bottom === next.bottom ? prev : next));
      setText(readText(el));
      setDark(isDarkBehind(el));
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

  // An emptied box means the prompt was sent: forget what was muted for it.
  useEffect(() => {
    if (words === 0) {
      setMuted(new Set());
      setOpen(false);
    }
  }, [words]);

  const gaps = useMemo(
    () => runChecks(text, { sensitivity: level, disabled }).filter((gap) => !muted.has(gap.id)),
    [text, level, disabled, muted],
  );

  if (siteOff || !anchor || words < 3) return null;

  return (
    <div
      className={`${dark ? '' : 'pf-light'} fixed z-[2147483646] flex flex-col items-end gap-2 font-sans text-ink antialiased`}
      style={{ right: anchor.right, bottom: anchor.bottom }}
    >
      {open && (
        <Panel
          gaps={gaps}
          onClose={() => setOpen(false)}
          onMute={(id) => setMuted((prev) => new Set(prev).add(id))}
        />
      )}
      <Badge count={gaps.length} open={open} onClick={() => setOpen((v) => !v)} />
    </div>
  );
}
