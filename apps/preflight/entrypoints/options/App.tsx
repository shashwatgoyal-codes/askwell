import type { CheckId, CustomRule, Sensitivity } from '@askwell/rules';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Mark } from '@/components/Mark';
import type { ModelsRequest, ModelsResponse, ProbeRequest, ProbeResponse } from '@/lib/improve/contract';
import {
  PROVIDERS,
  apiKeys,
  clearAll,
  conversationCoaching,
  customRules,
  library,
  MAX_CUSTOM_RULES,
  type SavedPrompt,
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
  { id: 'context', name: 'Context', detail: 'Errors, code, anything pointed to but not included, and a plan’s starting level', from: 'relaxed' },
  { id: 'goal', name: 'Goal', detail: 'What “done” looks like, or what a learning plan is for', from: 'balanced' },
  { id: 'constraints', name: 'Constraints', detail: 'A plan’s time frame; for code changes, what must not change (Strict)', from: 'balanced' },
  { id: 'output', name: 'Output', detail: 'The shape of the answer: a plan’s format; for code changes, patch or file (Strict)', from: 'balanced' },
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
  const [modelStatus, setModelStatus] = useState<
    { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok'; model: string } | { kind: 'error'; text: string; detail?: string }
  >({ kind: 'idle' });

  // One tiny real request, so a model that won't answer this key is caught
  // here and not on the first Improve.
  const probe = async (key: string, model: string) => {
    setModelStatus({ kind: 'checking' });
    const request: ProbeRequest = { type: 'probe-model', provider: chosen, key, model };
    const response = (await browser.runtime.sendMessage(request)) as ProbeResponse;
    setModelStatus(
      response.ok
        ? { kind: 'ok', model }
        : { kind: 'error', text: response.error.replace(' Pick another model in settings.', ' Try another model above.'), detail: response.detail },
    );
  };
  const keyId = useId();
  const modelId = useId();

  // Switching provider shows that provider's saved key and clears the status.
  // Saving a key also updates `keys`, so this must not depend on it, or the
  // "Key works" confirmation would vanish the moment it was earned.
  const savedKey = keys[chosen] ?? '';
  useEffect(() => {
    setStatus({ kind: 'idle' });
    setModelStatus({ kind: 'idle' });
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
    if (response.models.length === 0) {
      setStatus({ kind: 'error', text: 'Key works, but it offers no text models Preflight can use.' });
      return;
    }
    await apiKeys.setValue({ ...keys, [chosen]: key });
    setList((prev) => ({ ...prev, [chosen]: response.models }));
    let current = picked[chosen];
    if (!current || !response.models.includes(current)) {
      current = chosen === 'anthropic' && response.models.includes('claude-opus-5-5') ? 'claude-opus-5-5' : response.models[0]!;
      await models.setValue({ ...picked, [chosen]: current });
    }
    setStatus({ kind: 'ok', text: `Key works · ${response.models.length} ${response.models.length === 1 ? 'model' : 'models'} available` });
    await probe(key, current);
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
        <label htmlFor={keyId} className="text-[13px] text-label">
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
          {status.kind === 'error' && <span className="shrink-0 text-xs text-danger">{status.text}</span>}
          {status.kind === 'idle' && keys[chosen] && (
            <button type="button" onClick={() => void remove()} className="shrink-0 cursor-pointer text-xs text-subtle hover:text-ink">
              Remove key
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={modelId} className="text-[13px] text-label">
          Model for Improve
        </label>
        <select
          id={modelId}
          value={picked[chosen] ?? ''}
          disabled={options.length === 0}
          onChange={(event) => {
            const model = event.target.value;
            void models.setValue({ ...picked, [chosen]: model });
            if (savedKey) void probe(savedKey, model);
          }}
          className={`${input} font-sans disabled:text-subtle`}
        >
          {options.length === 0 && <option value="">Test a key to see its models</option>}
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {modelStatus.kind === 'checking' && <span className="font-mono text-xs text-subtle">Checking the model answers…</span>}
        {modelStatus.kind === 'ok' && <span className="font-mono text-xs text-ink">✓ {modelStatus.model} answers this key</span>}
        {modelStatus.kind === 'error' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-danger">{modelStatus.text}</span>
            {modelStatus.detail && (
              <span className="rounded-lg border border-edge bg-surface px-2.5 py-2 font-mono text-[11.5px] break-words text-subtle">
                {modelStatus.detail}
              </span>
            )}
          </div>
        )}
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
  const coaching = useStored(conversationCoaching, true);

  const flip = <T,>(list: T[], item: T, on: boolean) => (on ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <Section number="02" label="CHECKS">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-label">Sensitivity</span>
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
        <li className="flex items-center justify-between gap-4 rounded-b-xl border-t border-edge bg-surface/60 px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">Conversation coaching</span>
            <span className="text-[12.5px] text-subtle">Nudges for errors sent one by one, repeated fixes, and long sessions</span>
          </div>
          <Toggle label="Conversation coaching" on={coaching} onChange={(on) => void conversationCoaching.setValue(on)} />
        </li>
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

function RulesSection() {
  const rules = useStored(customRules, [] as CustomRule[]);
  const empty = { name: '', when: '', require: '', message: '' };
  const [draft, setDraft] = useState(empty);
  const ids = { name: useId(), when: useId(), require: useId(), message: useId() };
  const full = rules.length >= MAX_CUSTOM_RULES;
  const ready = draft.name.trim() && draft.require.trim() && !full;

  const add = async () => {
    if (!ready) return;
    const rule: CustomRule = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      when: draft.when.trim(),
      require: draft.require.trim(),
      ...(draft.message.trim() ? { message: draft.message.trim() } : {}),
    };
    await customRules.setValue([...rules, rule]);
    setDraft(empty);
  };

  const field = (key: keyof typeof empty, label: string, placeholder: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={ids[key]} className="text-[13px] text-label">
        {label}
      </label>
      <input
        id={ids[key]}
        type="text"
        value={draft[key]}
        placeholder={placeholder}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        onKeyDown={(event) => event.key === 'Enter' && void add()}
        className={`${input} font-sans`}
      />
    </div>
  );

  return (
    <Section number="03" label="YOUR RULES">
      <p className="-mt-1 text-[13px] leading-relaxed text-muted">
        Checks of your own, in plain words: when a prompt mentions something, it should also mention something
        else. Separate several words with commas.
      </p>
      {rules.length > 0 && (
        <ul className="flex flex-col rounded-xl border border-edge">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-4 px-4 py-3.5 [&+&]:border-t [&+&]:border-edge">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm">{rule.name}</span>
                <span className="truncate text-[12.5px] text-subtle">
                  {rule.when ? `When it mentions ${rule.when}, ` : 'Every prompt '}should mention {rule.require}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void customRules.setValue(rules.filter((r) => r.id !== rule.id))}
                className="h-8 shrink-0 cursor-pointer rounded-lg px-3 text-[13px] text-subtle hover:bg-raised hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-edge p-4">
        {field('name', 'Name', 'Prisma version')}
        <div className="grid grid-cols-2 gap-3">
          {field('when', 'When the prompt mentions (optional)', 'prisma')}
          {field('require', 'It should also mention', 'prisma 5, prisma 6')}
        </div>
        {field('message', 'Message (optional)', 'Say which Prisma version you are on.')}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12.5px] text-subtle">
            {full ? `That’s the limit of ${MAX_CUSTOM_RULES} rules.` : 'Rules run with the built-in checks and can be muted the same way.'}
          </span>
          <button type="button" onClick={() => void add()} disabled={!ready} className={ghost}>
            Add rule
          </button>
        </div>
      </div>
    </Section>
  );
}

function LibrarySection() {
  const items = useStored(library, [] as SavedPrompt[]);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Section number="04" label="LIBRARY">
      <p className="-mt-1 text-[13px] leading-relaxed text-muted">
        Prompts you saved from the panel. Insert them from the panel’s Library tab, or copy them from here.
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge p-4 text-[13px] text-subtle">Nothing saved yet.</p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-edge">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3.5 [&+&]:border-t [&+&]:border-edge">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm">{item.title}</span>
                <span className="line-clamp-3 text-[12.5px] leading-snug whitespace-pre-wrap text-subtle">{item.text}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(item.text).then(() => {
                      setCopied(item.id);
                      setTimeout(() => setCopied(null), 1500);
                    })
                  }
                  className="h-8 cursor-pointer rounded-lg border border-edge px-3 text-[13px] hover:bg-raised"
                >
                  {copied === item.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete “${item.title}”`}
                  onClick={() => void library.setValue(items.filter((i) => i.id !== item.id))}
                  className="h-8 cursor-pointer rounded-lg px-3 text-[13px] text-subtle hover:bg-raised hover:text-ink"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DangerSection() {
  const [confirming, setConfirming] = useState(false);
  return (
    <Section number="05" label="DANGER ZONE">
      <div className="flex items-center justify-between gap-6 rounded-xl border border-danger-edge p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">Clear local data</span>
          <span className="text-[12.5px] text-subtle">Removes your keys, settings, rules, library and stats from this browser. This can’t be undone.</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirming) return setConfirming(true);
            void clearAll().then(() => setConfirming(false));
          }}
          onBlur={() => setConfirming(false)}
          className="h-[38px] shrink-0 cursor-pointer rounded-lg border border-danger-strong px-4 text-[13px] text-danger hover:bg-danger-wash"
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
          Settings. <span className="text-faint">All of it stays in this browser.</span>
        </h1>
        <ProviderSection />
        <ChecksSection />
        <RulesSection />
        <LibrarySection />
        <DangerSection />
        <p className="border-t border-edge pt-6 text-[12.5px] leading-relaxed text-subtle">
          Preflight is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic or Google.
          It never sends a message for you.
        </p>
      </main>
    </div>
  );
}
