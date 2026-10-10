import { describe, expect, it } from 'vitest';
import { withSaved } from './settings';

describe('withSaved', () => {
  it('titles a prompt by its first line and puts it first', () => {
    const items = withSaved(withSaved([], 'first prompt', 'a'), 'Second prompt\nwith more lines', 'b');
    expect(items.map((i) => i.title)).toEqual(['Second prompt', 'first prompt']);
  });

  it('shortens a long first line', () => {
    const [item] = withSaved([], 'x'.repeat(100), 'a');
    expect(item!.title).toHaveLength(58);
    expect(item!.title.endsWith('…')).toBe(true);
  });

  it('moves a saved-again prompt to the top instead of duplicating it', () => {
    let items = withSaved([], 'one', 'a');
    items = withSaved(items, 'two', 'b');
    items = withSaved(items, '  one  ', 'c');
    expect(items.map((i) => i.text)).toEqual(['one', 'two']);
  });

  it('ignores empty text and keeps at most 100', () => {
    expect(withSaved([], '   ', 'a')).toEqual([]);
    let items: ReturnType<typeof withSaved> = [];
    for (let i = 0; i < 120; i++) items = withSaved(items, `prompt ${i}`, String(i));
    expect(items).toHaveLength(100);
    expect(items[0]!.text).toBe('prompt 119');
  });
});
