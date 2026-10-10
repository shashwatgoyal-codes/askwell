import path from 'node:path';
import { test } from './fixtures';

// The store screenshots: exactly 1280×800, which both Firefox Add-ons and
// Edge Add-ons accept. Run with:
//   STORE=1 pnpm --filter @askwell/preflight exec playwright test e2e/store.spec.ts

test.skip(!process.env.STORE, 'Only when regenerating the store screenshots (STORE=1).');

const out = (name: string) => path.resolve(import.meta.dirname, '../../../store/screenshots', name);

test('store screenshots', async ({ context, extensionId, site }) => {
  test.setTimeout(120_000);
  await context.route('https://api.anthropic.com/**', (route) =>
    route.request().url().includes('/v1/models')
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }], has_more: false }) })
      : route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
            content: [{ type: 'text', text: JSON.stringify({
              rewrite: 'Fix the login bug in my Next.js app: valid credentials return 401 from /api/auth/login. Error: [paste the error here]. Expected: redirect to /dashboard. Reply with a patch only.',
              changes: [
                { kind: 'context', added: ' in my Next.js app: valid credentials return 401 from /api/auth/login.', reason: 'Names where the bug happens.' },
                { kind: 'context', added: 'Error: [paste the error here].', reason: 'Leaves a slot for the actual failure.' },
                { kind: 'goal', added: 'Expected: redirect to /dashboard.', reason: 'Says what working looks like.' },
                { kind: 'output', added: 'Reply with a patch only.', reason: 'Asks for a patch instead of an essay.' },
              ],
            }) }],
          }),
        }),
  );

  const settings = await context.newPage();
  await settings.emulateMedia({ colorScheme: 'dark' });
  await settings.setViewportSize({ width: 1280, height: 800 });
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Anthropic API key').fill('sk-ant-store-example');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  await settings.getByText('answers this key').waitFor();
  await settings.screenshot({ path: out('4-settings.png') });

  const page = await site('https://chatgpt.com/');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('1-gaps.png') });

  await page.getByRole('button', { name: 'Improve with AI' }).click();
  await page.getByRole('button', { name: 'Apply to chat' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('2-improve.png') });

  const chat = await site('https://chatgpt.com/c/errors');
  await chat.setViewportSize({ width: 1280, height: 800 });
  await chat.locator('#prompt-textarea').click();
  await chat.keyboard.type('another one: 500 on /api/session/refresh');
  await chat.getByText('Third error in a row.').waitFor();
  await chat.waitForTimeout(300);
  await chat.screenshot({ path: out('3-nudge.png') });
});
