import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve(import.meta.dirname, '../dist/chrome-mv3');

// The chat sites need a login, so tests serve a stand-in page at the real
// address. The content script matches on the URL, so it loads exactly as it
// would on the site; only the page around the prompt box is ours.
const chatgpt = (messages: string[] = []) => `<!doctype html><html><body style="margin:0;background:#212121;color:#ececec;font:15px/1.5 -apple-system,system-ui,sans-serif">
    <main id="thread" style="height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;padding:24px 15% 0">
      ${messages
        .map(
          (m) =>
            `<div data-message-author-role="user" style="align-self:flex-end;max-width:70%;background:#303030;border-radius:18px;padding:10px 16px">${m}</div>` +
            `<div data-message-author-role="assistant" style="color:#b4b4b4">Here is a fix.</div>`,
        )
        .join('')}
      <form style="margin:10px 0 32px;background:#303030;border-radius:26px;padding:14px 16px;display:flex;align-items:flex-end;gap:12px">
        <div id="prompt-textarea" contenteditable="true" class="ProseMirror" style="flex:1;min-height:24px;outline:none;padding:4px 2px"></div>
        <button type="button" aria-label="Send prompt" style="width:34px;height:34px;border-radius:50%;border:0;background:#ececec;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#212121" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
      </form>
    </main></body></html>`;

const PAGES: Record<string, string> = {
  'https://chatgpt.com/c/errors': chatgpt([
    "TypeError: Cannot read properties of undefined (reading 'id') at getUser (auth.ts:42)",
    'now this: PrismaClientKnownRequestError P2025 at updateSession',
  ]),
  'https://chatgpt.com/': chatgpt(),
  // A redesign none of the known selectors match: no id, plain textarea.
  'https://chatgpt.com/redesigned': `<!doctype html><html><body style="margin:0;background:#212121;color:#ececec;font-family:sans-serif">
    <main style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:0 15%">
      <input type="search" placeholder="Search chats" style="position:absolute;top:10px;left:10px;width:400px">
      <div class="composer-v9" style="margin-bottom:32px;background:#303030;border-radius:24px;padding:16px">
        <textarea class="prompt-v9" rows="2" style="width:100%;background:transparent;color:inherit;border:0;outline:none;font:inherit"></textarea>
      </div>
    </main></body></html>`,
  'https://gemini.google.com/app': `<!doctype html><html><body style="margin:0;background:#ffffff;color:#1f1f1f;font-family:sans-serif">
    <main style="height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:0 15%">
      <rich-textarea style="display:block;margin-bottom:32px;border:1px solid #ddd;border-radius:24px;padding:16px">
        <div class="ql-editor textarea" contenteditable="true" aria-label="Enter a prompt for Gemini" style="min-height:24px;outline:none"></div>
        <div class="ql-clipboard" contenteditable="true" tabindex="-1" style="position:absolute;left:-10000px;height:1px;overflow:hidden"></div>
      </rich-textarea>
    </main></body></html>`,
};

export const test = base.extend<{ context: BrowserContext; extensionId: string; site: (url: string) => Promise<Page> }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // Crisp images when generating the README screenshots (DOCS=1).
      deviceScaleFactor: process.env.DOCS ? 2 : 1,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
  site: async ({ context }, use) => {
    await use(async (url) => {
      const html = PAGES[url];
      if (!html) throw new Error(`No stand-in page for ${url}`);
      const page = await context.newPage();
      await page.route(url, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
      await page.goto(url);
      return page;
    });
  },
});

export const expect = test.expect;
