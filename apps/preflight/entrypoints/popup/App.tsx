import type { CheckId } from '@askwell/rules';
import { useEffect, useState } from 'react';
import { Mark } from '@/components/Mark';
import {
  PROVIDERS,
  apiKeys,
  disabledSites,
  models,
  provider,
  stats,
  today,
  type DayStats,
  type Provider,
} from '@/lib/settings';
import { siteFor, type Site } from '@/lib/sites';

const LABEL: Record<CheckId, string> = {
  assumedMemory: 'ASSUMED MEMORY',
  context: 'CONTEXT',
  goal: 'GOAL',
  constraints: 'CONSTRAINTS',
  output: 'OUTPUT',
};

function useStored<T>(item: { getValue(): Promise<T>; watch(cb: (v: T) => void): () => void }, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    void item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return value;
}

function useActiveSite(): Site | null | undefined {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setSite(tab?.url ? (siteFor(new URL(tab.url).hostname) ?? null) : null);
    });
  }, []);
  return site;
}

export function App() {
  const site = useActiveSite();
  const sitesOff = useStored(disabledSites, [] as string[]);
  const day = useStored<DayStats>(stats, { day: '', checked: 0, gaps: 0, byCheck: {} });
  const chosen = useStored<Provider>(provider, 'anthropic');
  const keys = useStored(apiKeys, {} as Partial<Record<Provider, string>>);
  const picked = useStored(models, {} as Partial<Record<Provider, string>>);

  const current = day.day === today() ? day : { checked: 0, gaps: 0, byCheck: {} as DayStats['byCheck'] };
  const common = (Object.entries(current.byCheck) as [CheckId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const on = site ? !sitesOff.includes(site.id) : false;
  const providerName = PROVIDERS.find((p) => p.id === chosen)!.name;

  return (
    <main className="flex w-[380px] flex-col bg-surface font-sans text-ink antialiased">
      <header className="flex items-center justify-between px-[18px] py-4">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-medium">Preflight</span>
        </div>
        <span className="font-mono text-[11px] text-subtle">v{browser.runtime.getManifest().version}</span>
      </header>

      <div className="mx-[18px] flex items-center justify-between rounded-[10px] border border-edge bg-raised px-3.5 py-3">
        {site ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{site.hosts[0]}</span>
              <span className="text-xs text-muted">{on ? 'Coaching on this site' : 'Coaching is off here'}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`Coaching on ${site.name}`}
              onClick={() =>
                void disabledSites.setValue(on ? [...sitesOff, site.id] : sitesOff.filter((id) => id !== site.id))
              }
              className={`relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full ${on ? 'bg-accent' : 'border border-edge bg-surface'}`}
            >
              <span className={`absolute top-[3px] size-4 rounded-full ${on ? 'right-[3px] bg-on-accent' : 'left-[3px] bg-subtle'}`} />
            </button>
          </>
        ) : (
          <span className="text-[13px] text-muted">
            {site === undefined ? '…' : 'Open ChatGPT, Claude or Gemini to get coaching.'}
          </span>
        )}
      </div>

      <h2 className="px-[18px] pt-[22px] pb-2 font-mono text-[11px] font-normal tracking-[0.08em] text-subtle">TODAY</h2>
      <div className="mx-[18px] grid grid-cols-2 overflow-hidden rounded-[10px] border border-edge">
        <div className="flex flex-col gap-0.5 p-3.5">
          <span className="text-[28px] font-medium tracking-tight">{current.checked}</span>
          <span className="text-xs text-muted">prompts checked</span>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-edge p-3.5">
          <span className="text-[28px] font-medium tracking-tight">{current.gaps}</span>
          <span className="text-xs text-muted">gaps caught</span>
        </div>
      </div>
      <div className="mx-[18px] mt-2.5 flex items-center justify-between rounded-[10px] border border-edge px-3.5 py-3">
        <span className="text-[13px] text-muted">Most common gap</span>
        {common ? (
          <span className="rounded-md bg-wash px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-accent">{LABEL[common]}</span>
        ) : (
          <span className="font-mono text-xs text-subtle">none yet</span>
        )}
      </div>

      <h2 className="px-[18px] pt-[22px] pb-2 font-mono text-[11px] font-normal tracking-[0.08em] text-subtle">IMPROVE</h2>
      <div className="mx-[18px] flex flex-col rounded-[10px] border border-edge">
        <div className="flex items-center justify-between px-3.5 py-3">
          <span className="text-[13px]">{providerName} key</span>
          <span className="font-mono text-xs text-muted">{keys[chosen] ? '✓ saved' : 'not set'}</span>
        </div>
        <div className="flex items-center justify-between border-t border-edge px-3.5 py-3">
          <span className="text-[13px]">Model</span>
          <span className="font-mono text-xs text-muted">{picked[chosen] ?? '—'}</span>
        </div>
      </div>

      <footer className="mt-5 flex flex-col gap-2.5 border-t border-edge px-[18px] pt-4 pb-[18px]">
        <button
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
          className="h-10 cursor-pointer rounded-lg border border-edge text-[13px] hover:bg-raised"
        >
          Open settings
        </button>
        <p className="text-center font-mono text-[11px] text-subtle">Checks run in this browser. Your key never leaves it.</p>
      </footer>
    </main>
  );
}
