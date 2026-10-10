import { Mark } from '@/components/Mark';

export function App() {
  return (
    <main className="flex w-[380px] flex-col bg-surface font-sans text-ink">
      <header className="flex items-center justify-between px-[18px] py-4">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-medium">Preflight</span>
        </div>
        <span className="font-mono text-[11px] text-subtle">v{browser.runtime.getManifest().version}</span>
      </header>
      <footer className="flex flex-col gap-2.5 border-t border-edge px-[18px] pt-4 pb-[18px]">
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
          className="h-10 cursor-pointer rounded-lg border border-edge text-[13px] hover:bg-raised"
        >
          Open settings
        </button>
        <p className="text-center font-mono text-[11px] text-subtle">
          Checks run in this browser. Your key never leaves it.
        </p>
      </footer>
    </main>
  );
}
