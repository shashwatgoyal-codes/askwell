import type { Route } from '@playwright/test';
import { expect, test } from './fixtures';

// The provider is faked at the network layer: no key is real, nothing is billed.
const REWRITE = 'Fix the login bug in my Next.js app. Error: [paste the error here]. Expected: redirect to /dashboard.';

const anthropicMessage = (route: Route) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            rewrite: REWRITE,
            changes: [
              { kind: 'context', added: 'Error: [paste the error here].', reason: 'Gives the assistant the actual failure.' },
              { kind: 'goal', added: 'Expected: redirect to /dashboard.', reason: 'Says what working looks like.' },
            ],
          }),
        },
      ],
    }),
  });

const anthropicModels = (route: Route) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      data: [{ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }],
      has_more: false,
      first_id: 'claude-opus-5-5',
      last_id: 'claude-opus-5-5',
    }),
  });

test('a key is tested and saved, then Improve rewrites and applies', async ({ context, extensionId, site }) => {
  const seen: { url: string; headers: Record<string, string>; body: string | null }[] = [];
  await context.route('https://api.anthropic.com/**', (route) => {
    const request = route.request();
    seen.push({ url: request.url(), headers: request.headers(), body: request.postData() });
    return request.url().includes('/v1/models') ? anthropicModels(route) : anthropicMessage(route);
  });

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Anthropic API key').fill('sk-ant-test-not-real');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  await expect(settings.getByText('Key works · 1 model available')).toBeVisible();
  await expect(settings.getByLabel('Model for Improve')).toHaveValue('claude-opus-5-5');
  await expect(settings.getByText('✓ claude-opus-5-5 answers this key')).toBeVisible();

  const page = await site('https://chatgpt.com/');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.getByRole('button', { name: 'Improve with AI' }).click();

  const panel = page.getByRole('region', { name: 'Preflight' });
  await expect(panel.getByText('Expected: redirect to /dashboard.', { exact: true })).toBeVisible();
  await expect(panel.getByText('Gives the assistant the actual failure.')).toBeVisible();
  await expect(panel.getByText('claude-opus-5-5 · your key')).toBeVisible();

  await panel.getByRole('button', { name: 'Apply to chat' }).click();
  await expect(page.locator('#prompt-textarea')).toHaveText(REWRITE);
  await expect(panel).toBeHidden();

  // The request went to Anthropic only, with the user's key and the shape we promised.
  // The settings probe also posts to /v1/messages; the rewrite is the one with a JSON format.
  const call = seen.find((s) => new URL(s.url).pathname === '/v1/messages' && s.body?.includes('output_config'));
  expect(call?.headers['x-api-key']).toBe('sk-ant-test-not-real');
  const body = JSON.parse(call!.body!);
  expect(body.model).toBe('claude-opus-5-5');
  expect(body.output_config.format.type).toBe('json_schema');
  expect(body.messages[0].content).toContain('fix the login bug, same as before');
});

test('Improve without a key points to settings and changes nothing', async ({ site }) => {
  const page = await site('https://chatgpt.com/');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.getByRole('button', { name: 'Improve with AI' }).click();

  const panel = page.getByRole('region', { name: 'Preflight' });
  await expect(panel.getByText('No API key is set up yet.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Open settings' })).toBeVisible();
  await expect(page.locator('#prompt-textarea')).toHaveText('fix the login bug, same as before');
});

test('Gemini: only text models are offered, stable Flash first, and a 404 says what to do', async ({ context, extensionId, site }) => {
  await context.route('https://generativelanguage.googleapis.com/**', (route) => {
    const url = route.request().url();
    if (url.includes(':generateContent')) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 404, message: 'models/gemini-9.0-flash is not found for API version v1beta', status: 'NOT_FOUND' },
        }),
      });
    }
    const model = (name: string) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent', 'countTokens'] });
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        models: [
          model('gemini-9.0-pro-preview'),
          model('gemini-9.0-flash-image'),
          model('gemini-9.0-flash-preview-tts'),
          model('gemini-8.5-pro'),
          model('gemini-9.0-flash-lite'),
          model('gemini-9.0-flash'),
          { name: 'models/gemini-embedding-9', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    });
  });

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByRole('radio', { name: 'Gemini' }).click();
  await settings.getByLabel('Gemini API key').fill('AIza-test-not-real');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  await expect(settings.getByText('Key works · 4 models available')).toBeVisible();
  const options = await settings.getByLabel('Model for Improve').locator('option').allTextContents();
  expect(options).toEqual(['gemini-9.0-flash', 'gemini-9.0-flash-lite', 'gemini-8.5-pro', 'gemini-9.0-pro-preview']);
  await expect(settings.getByLabel('Model for Improve')).toHaveValue('gemini-9.0-flash');
  // Settings tries the model straight away and shows Google's own reason.
  await expect(settings.getByText('Gemini won’t serve gemini-9.0-flash to this key. Try another model above.')).toBeVisible();
  await expect(settings.getByText('models/gemini-9.0-flash is not found for API version v1beta')).toBeVisible();

  const page = await site('https://gemini.google.com/app');
  await page.locator('rich-textarea .ql-editor').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.getByRole('button', { name: 'Improve with AI' }).click();
  const panel = page.getByRole('region', { name: 'Preflight' });
  await expect(panel.getByText('Gemini won’t serve gemini-9.0-flash to this key. Pick another model in settings.')).toBeVisible();
  await expect(panel.getByText('models/gemini-9.0-flash is not found for API version v1beta')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Open settings' })).toBeVisible();
});

test('Gemini: an overloaded model is retried before giving up, and a lasting overload is explained', async ({ context, extensionId, site }) => {
  let generateCalls = 0;
  let failuresLeft = 2;
  await context.route('https://generativelanguage.googleapis.com/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'models/gemini-9.0-flash', supportedGenerationMethods: ['generateContent'] }] }),
      });
    }
    generateCalls++;
    if (failuresLeft > 0) {
      failuresLeft--;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' } }),
      });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }], role: 'model' } }] }) });
  });

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByRole('radio', { name: 'Gemini' }).click();
  await settings.getByLabel('Gemini API key').fill('AIza-test-not-real');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  // Two overloads, then an answer: the retries absorb them.
  await expect(settings.getByText('✓ gemini-9.0-flash answers this key')).toBeVisible({ timeout: 15_000 });
  expect(generateCalls).toBe(3);

  // A lasting overload: three 503s in a row reach the user, explained.
  failuresLeft = 3;
  const page = await site('https://gemini.google.com/app');
  await page.locator('rich-textarea .ql-editor').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();
  await page.getByRole('button', { name: 'Improve with AI' }).click();
  const panel = page.getByRole('region', { name: 'Preflight' });
  await expect(panel.getByText('Gemini is overloaded right now (Google’s side, not your key).', { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText('The model is overloaded. Please try again later.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('the chat page’s own scripts cannot press Improve or Apply', async ({ context, extensionId, site }) => {
  let calls = 0;
  await context.route('https://api.anthropic.com/**', (route) => {
    if (route.request().url().includes('/v1/messages')) calls++;
    return route.request().url().includes('/v1/models') ? anthropicModels(route) : anthropicMessage(route);
  });
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Anthropic API key').fill('sk-ant-test-not-real');
  await settings.getByRole('button', { name: 'Test and save' }).click();
  await expect(settings.getByText('answers this key')).toBeVisible();
  const afterSetup = calls;

  const page = await site('https://chatgpt.com/');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: /^Preflight: \d gaps/ }).click();

  // What a page script can do: reach into the open shadow root and click.
  const fakeClick = (label: string) =>
    page.evaluate((text) => {
      const root = document.querySelector('preflight-coach')!.shadowRoot!;
      const button = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
      button?.click();
      return Boolean(button);
    }, label);

  expect(await fakeClick('Improve with AI')).toBe(true);
  await page.waitForTimeout(800);
  expect(calls).toBe(afterSetup);
  // The panel stayed on the gaps list; no rewrite was started.
  await expect(page.getByRole('tab', { name: 'Gaps' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Rewriting with your key…')).toHaveCount(0);

  // A real click still works.
  await page.getByRole('button', { name: 'Improve with AI' }).click();
  await expect(page.getByRole('button', { name: 'Apply to chat' })).toBeVisible();
  expect(calls).toBe(afterSetup + 1);
  expect(await fakeClick('Apply to chat')).toBe(true);
  await expect(page.locator('#prompt-textarea')).toHaveText('fix the login bug, same as before');
});
