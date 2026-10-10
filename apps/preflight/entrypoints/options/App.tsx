import { Mark } from '@/components/Mark';

export function App() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header className="flex h-[60px] items-center gap-2.5 border-b border-edge px-8">
        <Mark size={24} />
        <span className="text-[15px] font-medium">Preflight</span>
        <span className="text-sm text-subtle">/</span>
        <span className="text-sm text-muted">Settings</span>
      </header>
      <main className="mx-auto flex w-[680px] flex-col gap-12 py-14">
        <h1 className="text-[40px] leading-tight font-medium tracking-tight">
          Settings. <span className="text-[#6b6b73]">All of it stays in this browser.</span>
        </h1>
        <p className="border-t border-edge pt-6 text-[12.5px] leading-relaxed text-subtle">
          Preflight is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic or Google.
          It never sends a message for you.
        </p>
      </main>
    </div>
  );
}
