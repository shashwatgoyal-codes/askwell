// Each chat site keeps its prompt box somewhere different, and moves it
// when it redesigns. Selectors are tried in order; the first visible match
// wins. When a site changes, this file is the only one that should need to.

export interface Site {
  id: 'chatgpt' | 'claude' | 'gemini';
  name: string;
  hosts: string[];
  selectors: string[];
}

export const SITES: Site[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com'],
    // Desktop uses a ProseMirror editor; narrow windows swap in a textarea.
    selectors: ['#prompt-textarea[contenteditable="true"]', '#prompt-textarea', '#mobile-composer-prompt', 'form textarea'],
  },
  {
    id: 'claude',
    name: 'Claude',
    hosts: ['claude.ai'],
    selectors: ['div.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"]', 'fieldset [contenteditable="true"]'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],
    // rich-textarea also holds a hidden .ql-clipboard; skip it.
    selectors: ['rich-textarea .ql-editor[contenteditable="true"]', 'rich-textarea [contenteditable="true"]:not(.ql-clipboard)'],
  },
];

export function siteFor(hostname: string): Site | undefined {
  return SITES.find((site) => site.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)));
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 80 && rect.height > 10 && getComputedStyle(el).visibility !== 'hidden';
}

export function findComposer(site: Site): HTMLElement | null {
  for (const selector of site.selectors) {
    const matches = [...document.querySelectorAll<HTMLElement>(selector)].filter(isVisible);
    const focused = matches.find((el) => el === document.activeElement || el.contains(document.activeElement));
    if (focused) return focused;
    if (matches.length) return matches[matches.length - 1]!;
  }
  return null;
}

export function readText(el: HTMLElement): string {
  return el instanceof HTMLTextAreaElement ? el.value : el.innerText;
}
