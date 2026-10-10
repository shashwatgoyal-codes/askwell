// Each chat site keeps its prompt box somewhere different, and moves it
// when it redesigns. Selectors are tried in order; the first visible match
// wins. When a site changes, this file is the only one that should need to.

export interface Site {
  id: 'chatgpt' | 'claude' | 'gemini';
  name: string;
  hosts: string[];
  selectors: string[];
  /** The person's own earlier messages in the open chat. */
  userMessages: string[];
}

export const SITES: Site[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com'],
    // Desktop uses a ProseMirror editor; narrow windows swap in a textarea.
    selectors: ['#prompt-textarea[contenteditable="true"]', '#prompt-textarea', '#mobile-composer-prompt', 'form textarea'],
    userMessages: ['[data-message-author-role="user"]'],
  },
  {
    id: 'claude',
    name: 'Claude',
    hosts: ['claude.ai'],
    selectors: ['div.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"]', 'fieldset [contenteditable="true"]'],
    userMessages: ['[data-testid="user-message"]'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],
    // rich-textarea also holds a hidden .ql-clipboard; skip it.
    selectors: ['rich-textarea .ql-editor[contenteditable="true"]', 'rich-textarea [contenteditable="true"]:not(.ql-clipboard)'],
    userMessages: ['user-query .query-text', 'user-query'],
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

/** The last `limit` messages the person sent in this chat, oldest first. Read only from the page; never stored. */
export function readUserMessages(site: Site, limit = 12): string[] {
  for (const selector of site.userMessages) {
    const found = [...document.querySelectorAll<HTMLElement>(selector)];
    if (found.length) return found.slice(-limit).map((el) => el.innerText.trim()).filter(Boolean);
  }
  return [];
}

export function readText(el: HTMLElement): string {
  return el instanceof HTMLTextAreaElement ? el.value : el.innerText;
}

/**
 * Put text in the prompt box the way typing would, so the site's editor
 * (React, ProseMirror, Quill) sees the change. Never submits.
 */
export function writeText(el: HTMLElement, text: string): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setValue?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  // execCommand is deprecated but it is still the one input path rich
  // editors listen to; writing innerHTML would bypass their state.
  if (!document.execCommand('insertText', false, text)) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
}
