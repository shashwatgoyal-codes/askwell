import path from 'node:path';
import type { Page } from '@playwright/test';
import { test } from './fixtures';

// Regenerates the images in docs/images for the README. Skipped in normal
// runs; run with:  DOCS=1 pnpm --filter @askwell/preflight exec playwright test e2e/docs.spec.ts

test.skip(!process.env.DOCS, 'Only when regenerating the README images (DOCS=1).');

const out = (name: string) => path.resolve(import.meta.dirname, '../../../docs/images', name);
const mark = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#FF6B4A"/><path d="M30 70L50 90L94 40M70 38H96V64" fill="none" stroke="#140803" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">`;

async function art(page: Page, width: number, height: number, body: string, file: string) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head>${FONTS}<style>
      body{margin:0;background:#0B0B0C;color:#EDEDEF;font-family:Geist,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mono{font-family:'Geist Mono',monospace}
    </style></head><body>${body}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(file) });
}

const REWRITE =
  'Fix the login bug in my Next.js app: valid credentials return 401 from /api/auth/login. Error: [paste the error here]. Expected: redirect to /dashboard. Reply with a patch only.';

test('README images', async ({ context, extensionId, site }) => {
  test.setTimeout(120_000);
  const canvas = await context.newPage();

  await art(
    canvas,
    1280,
    400,
    `<div style="height:400px;box-sizing:border-box;padding:0 96px;display:flex;align-items:center;gap:40px;border-bottom:1px solid #1F1F23">
      ${mark(112)}
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="font-size:64px;font-weight:500;letter-spacing:-0.03em;line-height:1">Preflight</div>
        <div style="font-size:26px;letter-spacing:-0.01em;color:#A1A1AA">Checks your AI prompt <span style="color:#EDEDEF">before you send it.</span></div>
        <div class="mono" style="font-size:14px;letter-spacing:0.08em;color:#8A8A93">BY ASKWELL · CHATGPT · CLAUDE · GEMINI · AND MORE</div>
      </div>
    </div>`,
    'banner.png',
  );

  await art(
    canvas,
    1280,
    640,
    `<div style="height:640px;box-sizing:border-box;padding:88px 96px;display:flex;flex-direction:column;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:20px">${mark(72)}<span style="font-size:36px;font-weight:500;letter-spacing:-0.02em">Preflight</span></div>
      <div style="font-size:76px;font-weight:500;letter-spacing:-0.035em;line-height:1.02">Checks your AI prompt<br><span style="color:#FF6B4A">before you send it.</span></div>
      <div class="mono" style="font-size:18px;letter-spacing:0.08em;color:#8A8A93">A FREE BROWSER EXTENSION BY ASKWELL · MIT</div>
    </div>`,
    'social-preview.png',
  );
  await canvas.close();

  // Gaps panel on a stand-in chat page.
  const page = await site('https://chatgpt.com/');
  await page.setViewportSize({ width: 1100, height: 640 });
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('gaps.png') });

  // The library, with two saved prompts.
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Save prompt' }).click();
  await page.getByRole('tab', { name: 'Gaps' }).click();

  // Improve: a faked provider, so nothing is sent and nothing is billed.
  await context.route('https://api.anthropic.com/**', (route) =>
    route.request().url().includes('/v1/models')
      ? route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }], has_more: false }),
        })
      : route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5-5',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  rewrite: REWRITE,
                  changes: [
                    { kind: 'context', added: ' in my Next.js app: valid credentials return 401 from /api/auth/login.', reason: 'Names where the bug happens.' },
                    { kind: 'context', added: 'Error: [paste the error here].', reason: 'Leaves a slot for the actual failure.' },
                    { kind: 'goal', added: 'Expected: redirect to /dashboard.', reason: 'Says what working looks like.' },
                    { kind: 'output', added: 'Reply with a patch only.', reason: 'Asks for a patch instead of an essay.' },
                  ],
                }),
              },
            ],
          }),
        }),
  );
  const settings = await context.newPage();
  await settings.emulateMedia({ colorScheme: 'dark' });
  await settings.setViewportSize({ width: 1000, height: 1080 });
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Anthropic API key').fill('sk-ant-docs-example');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  await settings.getByText('answers this key').waitFor();
  await settings.screenshot({ path: out('settings.png') });

  await page.bringToFront();
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.getByRole('button', { name: 'Improve with AI' }).click();
  await page.getByRole('button', { name: 'Apply to chat' }).waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out('improve.png') });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out('library.png') });

  // A conversation nudge.
  const chat = await site('https://chatgpt.com/c/errors');
  await chat.setViewportSize({ width: 1100, height: 560 });
  await chat.locator('#prompt-textarea').click();
  await chat.keyboard.type('another one: 500 on /api/session/refresh');
  await chat.getByText('Third error in a row.').waitFor();
  await chat.waitForTimeout(200);
  await chat.screenshot({ path: out('nudge.png') });

  // The popup, after the weak prompt from the first page is sent.
  await page.bringToFront();
  await page.evaluate(() => {
    const box = document.getElementById('prompt-textarea')!;
    const sent = document.createElement('div');
    sent.dataset.messageAuthorRole = 'user';
    sent.textContent = box.textContent;
    box.closest('form')!.before(sent);
    box.textContent = '';
    box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: 'dark' });
  await popup.setViewportSize({ width: 380, height: 760 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  // A believable fortnight of counts, so the weekly view has something to show.
  await popup.evaluate(async () => {
    const day = (offset: number) => {
      const t = new Date();
      t.setDate(t.getDate() + offset);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    };
    const rows = [[-12, 6, 11], [-9, 4, 7], [-6, 5, 6], [-5, 8, 7], [-3, 3, 2], [-2, 7, 4], [-1, 6, 3], [0, 4, 3]].map(([o, c, g]) => ({
      day: day(o!),
      checked: c,
      gaps: g,
      byCheck: { goal: Math.ceil(g! / 2), context: Math.floor(g! / 2) },
    }));
    await (globalThis as unknown as { chrome: { storage: { local: { set(v: object): Promise<void> } } } }).chrome.storage.local.set({ history: rows });
  });
  await popup.reload();
  await popup.waitForTimeout(400);
  await popup.screenshot({ path: out('popup.png') });
});
