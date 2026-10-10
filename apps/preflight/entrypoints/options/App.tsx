import type { CheckId, Sensitivity } from '@askwell/rules';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Mark } from '@/components/Mark';
import type { ModelsRequest, ModelsResponse } from '@/lib/improve/contract';
import {
  PROVIDERS,
  apiKeys,
  clearAll,
  disabledChecks,
  disabledSites,
  models,
  provider as providerItem,
  sensitivity as sensitivityItem,
  type Provider,
} from '@/lib/settings';
import { SITES } from '@/lib/sites';

const CHECKS: { id: CheckId; name: string; detail: string; from: Sensitivity }[] = [
  { id: 'assumedMemory', name: 'Assumed memory', detail: '“As you know”, “like before”: things the AI can’t see', from: 'relaxed' },
  { id: 'context', name: 'Context', detail: 'Errors, code and anything the prompt points to but doesn’t include', from: 'relaxed' },
  { id: 'goal', name: 'Goal', detail: 'Says what “done” looks like', from: 'balanced' },
  { id: 'constraints', name: 'Constraints', detail: 'What must not change', from: 'strict' },
  { id: 'output', name: 'Output', detail: 'The shape of the answer you want back', from: 'strict' },
];
const RANK: Record<Sensitivity, number> = { relaxed: 0, balanced: 1, strict: 2 };

function useStored<T>(item: { getValue(): Promise<T>; watch(cb: (v: T) => void): () => void }, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    void item.getValue().then(setValue);
    return item.watch(setValue);
  }, [item]);
  return value;
}

function Section({ number, label, children }: { number: string; label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px]">
      <h2 className="flex items-center gap-2.5 border-b border-edge pb-3 font-mono text-[11px] font-normal">
        <span className="text-accent">{number}</span>
        <span className="tracking-[0.08em] text-subtle">{label}</span>
      </h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; name: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 self-start rounded-[10px] border border-edge bg-surface p-[3px]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-[34px] cursor-pointer rounded-[7px] px-4 text-[13px] ${
            value === option.id ? 'bg-raised font-medium text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full ${on ? 'bg-accent' : 'border border-edge bg-raised'}`}
    >
      <span className={`absolute top-[3px] size-4 rounded-full transition-all ${on ? 'right-[3px] bg-on-accent' : 'left-[3px] bg-subtle'}`} />
    </button>
  );
}

const input =
  'h-[42px] w-full rounded-lg border border-edge bg-surface px-3.5 font-mono text-[13px] text-ink outline-none focus:border-subtle';
const ghost = 'h-[42px] shrink-0 cursor-pointer rounded-lg border border-edge px-4 text-[13px] hover:bg-raised disabled:cursor-default disabled:opacity-50';

function ProviderSection() {
  const chosen = useStored(providerItem, 'anthropic' as Provider);
  const keys = useStored(apiKeys, {} as Partial<Record<Provider, string>>);
  const picked = useStored(models, {} as Partial<Record<Provider, string>>);
  const [draft, setDraft] = useState('');
  const [list, setList] = useState<Partial<Record<Provider, string[]>>>({});
  const [status, setStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  const keyId = useId();
  const modelId = useId();

  // Switching provider shows that provider's saved key and clears the status.
  // Saving a key also updates `keys`, so this must not depend on it, or the
  // "Key works" confirmation would vanish the moment it was earned.
  const savedKey = keys[chosen] ?? '';
  useEffect(() => {
    setStatus({ kind: 'idle' });
  }, [chosen]);
  useEffect(() => {
    setDraft(savedKey);
  }, [chosen, savedKey]);

  const test = async () => {
    const key = draft.trim();
    if (!key) return;
    setStatus({ kind: 'testing' });
    const request: ModelsRequest = { type: 'list-models', provider: chosen, key };
    const response = (await browser.runtime.sendMessage(request)) as ModelsResponse;
    if (!response.ok) {
      setStatus({ kind: 'error', text: response.error });
      return;
    }
    await apiKeys.setValue({ ...keys, [chosen]: key });
    setList((prev) => ({ ...prev, [chosen]: response.models }));
    const current = picked[chosen];
    if (!current || !response.models.includes(current)) {
      const fallback = chosen === 'anthropic' && response.models.includes('claude-opus-5-5') ? 'claude-opus-5-5' : response.models[0];
      if (fallback) await models.setValue({ ...picked, [chosen]: fallback });
    }
    setStatus({ kind: 'ok', text: `Key works · ${response.models.length} ${response.models.length === 1 ? 'model' : 'models'} available` });
  };

  const remove = async () => {
    const next = { ...keys };
    delete next[chosen];
    await apiKeys.setValue(next);
    setStatus({ kind: 'idle' });
  };

  const options = list[chosen] ?? (picked[chosen] ? [picked[chosen]!] : []);
  const name = PROVIDERS.find((p) => p.id === chosen)!.name;

  return (
    <Section number="01" label="AI PROVIDER">
      <p className="-mt-1 text-[13px] leading-relaxed text-muted">
        Only Improve uses a key. The checks never do.
      </p>
      <Segmented label="Provider" value={chosen} options={PROVIDERS} onChange={(id) => void providerItem.setValue(id)} />
      <div className="flex flex-col gap-2">
        <label htmlFor={keyId} className="text-[13px] text-[#d4d4d8]">
          {name} API key
        </label>
        <div className="flex gap-2">
          <input
            id={keyId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={PROVIDERS.find((p) => p.id === chosen)!.keyHint}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void test()}
            className={input}
          />
          <button type="button" onClick={() => void test()} disabled={!draft.trim() || status.kind === 'testing'} className={ghost}>
            {status.kind === 'testing' ? 'Testing…' : 'Test and save'}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 text-[12.5px]">
          <span className="text-subtle">Stored in this browser only. Calls go straight to {name}, never through us.</span>
          {status.kind === 'ok' && <span className="shrink-0 font-mono text-xs text-ink">✓ {status.text}</span>}
          {status.kind === 'error' && <span className="shrink-0 text-xs text-[#ff9a9f]">{status.text}</span>}
          {status.kind === 'idle' && keys[chosen] && (
            <button type="button" onClick={() => void remove()} className="shrink-0 cursor-pointer text-xs text-subtle hover:text-ink">
              Remove key
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={modelId} className="text-[13px] text-[#d4d4d8]">
          Model for Improve
        </label>
        <select
          id={modelId}
          value={picked[chosen] ?? ''}
          disabled={options.length === 0}
          onChange={(event) => void models.setValue({ ...picked, [chosen]: event.target.value })}
          className={`${input} font-sans disabled:text-subtle`}
        >
          {options.length === 0 && <option value="">Test a key to see its models</option>}
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-subtle">
          Each Improve is one short request, billed by {name} to your key.
        </span>
      </div>
    </Section>
  );
}

function ChecksSection() {
  const level = useStored(sensitivityItem, 'balanced' as Sensitivity);
  const off = useStored(disabledChecks, [] as CheckId[]);
  const sitesOff = useStored(disabledSites, [] as string[]);

  const flip = <T,>(list: T[], item: T, on: boolean) => (on ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <Section number="02" label="CHECKS">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#d4d4d8]">Sensitivity</span>
        <Segmented
          label="Sensitivity"
          value={level}
          options={[
            { id: 'relaxed', name: 'Relaxed' },
            { id: 'balanced', name: 'Balanced' },
            { id: 'strict', name: 'Strict' },
          ]}
          onChange={(id) => void sensitivityItem.setValue(id)}
        />
      </div>
      <ul className="flex flex-col rounded-xl border border-edge">
        {CHECKS.map((check) => {
          const active = RANK[check.from] <= RANK[level];
          return (
            <li key={check.id} className="flex items-center justify-between gap-4 px-4 py-3.5 [&+&]:border-t [&+&]:border-edge">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm">
                  {check.name}
                  {!active && <span className="font-mono text-[10.5px] tracking-[0.06em] text-subtle uppercase">{check.from} only</span>}
                </span>
                <span className="text-[12.5px] text-subtle">{check.detail}</span>
              </div>
              <Toggle label={`${check.name} check`} on={!off.includes(check.id)} onChange={(on) => void disabledChecks.setValue(flip(off, check.id, on))} />
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-col rounded-xl border border-edge">
        {SITES.map((site) => (
          <li key={site.id} className="flex items-center justify-between gap-4 px-4 py-3.5 [&+&]:border-t [&+&]:border-edge">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{site.name}</span>
              <span className="font-mono text-[12px] text-subtle">{site.hosts[0]}</span>
            </div>
            <Toggle label={`Coaching on ${site.name}`} on={!sitesOff.includes(site.id)} onChange={(on) => void disabledSites.setValue(flip(sitesOff, site.id, on))} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DangerSection() {
  const [confirming, setConfirming] = useState(false);
  return (
    <Section number="03" label="DANGER ZONE">
      <div className="flex items-center justify-between gap-6 rounded-xl border border-[#3a2326] p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">Clear local data</span>
          <span className="text-[12.5px] text-subtle">Removes your keys and settings from this browser. This can’t be undone.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirming) return setConfirming(true);
            void clearAll().then(() => setConfirming(false));
          }}
          onBlur={() => setConfirming(false)}
          className="h-[38px] shrink-0 cursor-pointer rounded-lg border border-[#7a2e33] px-4 text-[13px] text-[#ff9a9f] hover:bg-[#2a1517]"
        >
          {confirming ? 'Click again to clear' : 'Clear data'}
        </button>
      </div>
    </Section>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <header className="flex h-[60px] items-center justify-between border-b border-edge px-8">
        <div className="flex items-center gap-2.5">
          <Mark size={24} />
          <span className="text-[15px] font-medium">Preflight</span>
          <span className="text-sm text-subtle">/</span>
          <span className="text-sm text-muted">Settings</span>
        </div>
        <span className="font-mono text-xs text-subtle">v{browser.runtime.getManifest().version}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[680px] flex-col gap-12 px-4 pt-14 pb-16">
        <h1 className="text-[40px] leading-tight font-medium tracking-tight">
          Settings. <span className="text-[#6b6b73]">All of it stays in this browser.</span>
        </h1>
        <ProviderSection />
        <ChecksSection />
        <DangerSection />
        <p className="border-t border-edge pt-6 text-[12.5px] leading-relaxed text-subtle">
          Preflight is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic or Google.
          It never sends a message for you.
        </p>
      </main>
    </div>
  );
}
