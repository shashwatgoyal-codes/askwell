import { useEffect, useState } from 'react';
import { library, saveToLibrary, type SavedPrompt } from '@/lib/settings';
import { realClick } from './Panel';

interface Props {
  draft: string;
  /** Puts a saved prompt in the chat box (replacing the draft) and closes the panel. */
  onInsert: (text: string) => void;
}

export function LibraryView({ draft, onInsert }: Props) {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  useEffect(() => {
    void library.getValue().then(setItems);
    return library.watch(setItems);
  }, []);

  const saved = items.some((item) => item.text === draft.trim());

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
        <span className="text-[13px] text-muted">
          {saved ? 'This prompt is in your library.' : 'Keep this prompt to reuse later.'}
        </span>
        <button
          type="button"
          disabled={saved || !draft.trim()}
          onClick={realClick(() => void saveToLibrary(draft))}
          className="h-8 shrink-0 cursor-pointer rounded-lg border border-edge px-3 text-[13px] hover:bg-raised disabled:cursor-default disabled:opacity-50"
        >
          {saved ? 'Saved' : 'Save prompt'}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-[13px] leading-normal text-muted">
          Nothing saved yet. Save a prompt here, or an Improve rewrite with its Save button.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 border-edge px-4 py-3 [&+&]:border-t">
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="truncate text-sm">{item.title}</span>
                <span className="line-clamp-2 text-[12.5px] leading-snug text-subtle">{item.text}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Delete “${item.title}”`}
                  onClick={() => void library.setValue(items.filter((i) => i.id !== item.id))}
                  className="h-8 cursor-pointer rounded-lg px-2 text-[12px] text-subtle hover:bg-raised hover:text-ink"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={realClick(() => onInsert(item.text))}
                  className="h-8 cursor-pointer rounded-lg border border-edge px-3 text-[12.5px] hover:bg-raised"
                >
                  Insert
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
