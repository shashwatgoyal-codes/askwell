import { expect, test } from './fixtures';

// Exists inside extension pages, where page.evaluate runs below.
declare const chrome: { storage: { local: { get(keys: null): Promise<Record<string, unknown>> } } };

test.describe('conversation nudges', () => {
  test('the third lone error in a row gets a nudge, and its template replaces the draft', async ({ site }) => {
    const page = await site('https://chatgpt.com/c/errors');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('another one: 500 on /api/session/refresh');

    const nudge = page.getByRole('complementary', { name: 'Preflight nudge' });
    await expect(nudge.getByText('Third error in a row.')).toBeVisible();
    await nudge.getByRole('button', { name: 'Insert template' }).click();

    await expect(page.locator('#prompt-textarea')).toContainText('Here is everything failing, together:');
    await expect(page.locator('#prompt-textarea')).toContainText('another one: 500 on /api/session/refresh');
    await expect(nudge).toBeHidden();
  });

  test('Not now hides it for this chat', async ({ site }) => {
    const page = await site('https://chatgpt.com/c/errors');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('another one: 500 on /api/session/refresh');
    const nudge = page.getByRole('complementary', { name: 'Preflight nudge' });
    await nudge.getByRole('button', { name: 'Not now' }).click();
    await expect(nudge).toBeHidden();
    await page.keyboard.type(' and ECONNREFUSED');
    await expect(nudge).toBeHidden();
  });

  test('a new chat that leans on earlier work offers summary lines', async ({ site }) => {
    const page = await site('https://chatgpt.com/');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('continue where we left off on the auth refactor');
    await expect(page.getByText('Starting fresh?')).toBeVisible();
  });

  test('switching conversation coaching off in settings removes nudges', async ({ context, extensionId, site }) => {
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html`);
    await settings.getByRole('switch', { name: 'Conversation coaching' }).click();
    await expect(settings.getByRole('switch', { name: 'Conversation coaching' })).toHaveAttribute('aria-checked', 'false');

    const page = await site('https://chatgpt.com/c/errors');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('another one: 500 on /api/session/refresh');
    await expect(page.getByRole('button', { name: /^Preflight: \d gaps?/ }).or(page.getByRole('button', { name: 'Preflight: no gaps' }))).toBeVisible();
    await expect(page.getByText('Third error in a row.')).toHaveCount(0);
  });
});

test('a sent prompt is counted in today’s stats, without its text', async ({ context, extensionId, site }) => {
  const page = await site('https://chatgpt.com/');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await expect(page.getByRole('button', { name: 'Preflight: 3 gaps in this prompt' })).toBeVisible();

  // What the site does on Send: the message joins the thread and the box empties.
  await page.evaluate(() => {
    const box = document.getElementById('prompt-textarea')!;
    const sent = document.createElement('div');
    sent.dataset.messageAuthorRole = 'user';
    sent.textContent = box.textContent;
    box.closest('form')!.before(sent);
    box.textContent = '';
    box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('prompts checked').locator('..')).toContainText('1');
  await expect(popup.getByText('gaps caught').locator('..')).toContainText('3');
  await expect(popup.getByText('ASSUMED MEMORY')).toBeVisible();

  const stored = await popup.evaluate(() => chrome.storage.local.get(null));
  expect(JSON.stringify(stored)).not.toContain('login bug');
});

test('opening a chat with history counts nothing', async ({ context, extensionId, site }) => {
  const page = await site('https://chatgpt.com/c/errors');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('another one: 500 on /api/session/refresh');
  await expect(page.getByText('Third error in a row.')).toBeVisible();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('prompts checked').locator('..')).toContainText('0');
});
