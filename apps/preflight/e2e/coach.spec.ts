import { expect, test } from './fixtures';

test('the extension ID is the pinned one', async ({ extensionId }) => {
  expect(extensionId).toBe('njmfodabahadgjogbooodnfecikbkiap');
});

test.describe('on ChatGPT', () => {
  test('flags the weak prompt and explains each gap', async ({ site }) => {
    const page = await site('https://chatgpt.com/');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('fix the login bug, same as before');

    const badge = page.getByRole('button', { name: 'Preflight: 3 gaps in this prompt' });
    await expect(badge).toBeVisible();
    await badge.click();

    const panel = page.getByRole('region', { name: 'Preflight' });
    await expect(panel.getByText('“same as before” points to context this chat doesn’t have.')).toBeVisible();
    await expect(panel.getByText('You mention a bug, but no error is attached.')).toBeVisible();
    // Two at a time; the third waits behind a button.
    await expect(panel.getByText('It isn’t clear what working looks like.')).toBeHidden();
    await panel.getByRole('button', { name: 'Show 1 more' }).click();
    await expect(panel.getByText('It isn’t clear what working looks like.')).toBeVisible();

    await panel.getByRole('button', { name: 'Mute' }).first().click();
    await expect(page.getByRole('button', { name: 'Preflight: 2 gaps in this prompt' })).toBeVisible();
  });

  test('stays quiet while typing and says clear for a complete prompt', async ({ site }) => {
    const page = await site('https://chatgpt.com/');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('fix the');
    await expect(page.getByRole('button', { name: /^Preflight/ })).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Fix the 401 on /api/auth/login. Expected: redirect to /dashboard.');
    await expect(page.getByRole('button', { name: 'Preflight: no gaps' })).toBeVisible();
  });

  test('matches a dark site', async ({ site }) => {
    const page = await site('https://chatgpt.com/');
    await page.locator('#prompt-textarea').click();
    await page.keyboard.type('the signup form is broken again');
    await expect(page.getByRole('button', { name: /^Preflight: \d gaps?/ })).toBeVisible();
    await expect(page.locator('preflight-coach .pf-light')).toHaveCount(0);
  });

  test('disappears once the prompt is sent', async ({ site }) => {
    const page = await site('https://chatgpt.com/');
    const box = page.locator('#prompt-textarea');
    await box.click();
    await page.keyboard.type('the signup form is broken again');
    await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();
    await box.evaluate((el) => {
      el.textContent = '';
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    await expect(page.getByRole('button', { name: /^Preflight/ })).toHaveCount(0);
  });
});

test.describe('on Gemini', () => {
  test('finds the real editor, not the hidden clipboard, and matches a light site', async ({ site }) => {
    const page = await site('https://gemini.google.com/app');
    await page.locator('rich-textarea .ql-editor').click();
    await page.keyboard.type('refactor this function to be readable');

    await expect(page.getByRole('button', { name: 'Preflight: 1 gap in this prompt' })).toBeVisible();
    await expect(page.locator('preflight-coach .pf-light')).toHaveCount(1);
  });
});

test('a redesigned prompt box no selector knows is still found once you type in it', async ({ site }) => {
  const page = await site('https://chatgpt.com/redesigned');
  // A search field is never taken for the prompt box.
  await page.getByPlaceholder('Search chats').click();
  await page.keyboard.type('fix the login bug, same as before');
  await expect(page.getByRole('button', { name: /^Preflight/ })).toHaveCount(0);

  await page.locator('textarea.prompt-v9').click();
  await page.keyboard.type('fix the login bug, same as before');
  const badge = page.getByRole('button', { name: 'Preflight: 3 gaps in this prompt' });
  await expect(badge).toBeVisible();
  // Clicking the badge moves focus away from the box; the coach keeps following it.
  await badge.click();
  await expect(page.getByRole('region', { name: 'Preflight' })).toBeVisible();
});

test.describe('the newer sites', () => {
  for (const [url, box] of [
    ['https://www.perplexity.ai/', '#ask-input'],
    ['https://grok.com/', 'div.tiptap'],
    ['https://chat.mistral.ai/chat', 'div.ProseMirror'],
  ] as const) {
    test(`flags a weak prompt on ${new URL(url).hostname}`, async ({ site }) => {
      const page = await site(url);
      await page.locator(box).click();
      await page.keyboard.type('fix the login bug, same as before');
      await expect(page.getByRole('button', { name: 'Preflight: 3 gaps in this prompt' })).toBeVisible();
    });
  }

  test('no conversation nudges where the history can’t be read', async ({ site }) => {
    const page = await site('https://www.perplexity.ai/');
    await page.locator('#ask-input').click();
    await page.keyboard.type('continue where we left off on the auth refactor');
    await expect(page.getByRole('button', { name: /^Preflight/ })).toBeVisible();
    await expect(page.getByText('Starting fresh?')).toHaveCount(0);
  });
});

test('a rule written in settings flags prompts on the page, under its own name', async ({ context, extensionId, site }) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Name').fill('Prisma version');
  await settings.getByLabel('When the prompt mentions (optional)').fill('prisma');
  await settings.getByLabel('It should also mention').fill('prisma 5, prisma 6');
  await settings.getByRole('button', { name: 'Add rule' }).click();
  await expect(settings.getByText('When it mentions prisma, should mention prisma 5, prisma 6')).toBeVisible();

  const page = await site('https://chatgpt.com/');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('Prisma throws P2025 on update, expected the row to change');
  await page.getByRole('button', { name: 'Preflight: 1 gap in this prompt' }).click();
  const panel = page.getByRole('region', { name: 'Preflight' });
  await expect(panel.getByText('01 · Your rule · Prisma version')).toBeVisible();
  await expect(panel.getByText('Your rule “Prisma version”: mention “prisma 5” or “prisma 6”.')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type(' on Prisma 6');
  await expect(page.getByRole('button', { name: 'Preflight: no gaps' })).toBeVisible();
});

test('a prompt saved to the library can be inserted later and managed in settings', async ({ context, extensionId, site }) => {
  const page = await site('https://chatgpt.com/');
  const box = page.locator('#prompt-textarea');
  await box.click();
  await page.keyboard.type('Review this diff for race conditions and reply with a numbered list');
  await page.getByRole('button', { name: /^Preflight/ }).click();
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Save prompt' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await box.evaluate((el) => {
    el.textContent = '';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  await box.click();
  await page.keyboard.type('something else entirely now');
  await page.getByRole('button', { name: /^Preflight/ }).click();
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(box).toHaveText('Review this diff for race conditions and reply with a numbered list');

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(settings.getByText('Review this diff for race conditions and reply with a numbered list').first()).toBeVisible();
  await settings.getByRole('button', { name: /^Delete “Review this diff/ }).click();
  await expect(settings.getByText('Nothing saved yet.')).toBeVisible();
});
