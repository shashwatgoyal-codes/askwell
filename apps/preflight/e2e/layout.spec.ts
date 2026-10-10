import { expect, test } from './fixtures';

test('a long panel scrolls inside itself instead of leaving the window', async ({ site }) => {
  const page = await site('https://chatgpt.com/');
  await page.setViewportSize({ width: 1000, height: 460 });
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('fix the login bug, same as before');
  await page.getByRole('button', { name: 'Preflight: 3 gaps in this prompt' }).click();
  const panel = page.getByRole('region', { name: 'Preflight' });
  await panel.getByRole('button', { name: 'Show 1 more' }).click();

  const box = await panel.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  // Header and footer stay put; the list between them scrolls.
  await expect(panel.getByRole('button', { name: 'Close' })).toBeInViewport();
  await expect(panel.getByRole('button', { name: 'Improve with AI' })).toBeInViewport();
  const scrolls = await panel.evaluate((el) => {
    const middle = el.querySelector('.overflow-y-auto') as HTMLElement;
    return middle.scrollHeight > middle.clientHeight;
  });
  expect(scrolls).toBe(true);
  await panel.getByText('It isn’t clear what working looks like.').scrollIntoViewIfNeeded();
  await expect(panel.getByText('It isn’t clear what working looks like.')).toBeInViewport();
});

test('the popup and settings follow the device theme, live', async ({ context, extensionId }) => {
  const settings = await context.newPage();
  await settings.emulateMedia({ colorScheme: 'dark' });
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(settings.locator('html')).not.toHaveClass(/pf-light/);
  const dark = await settings.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await settings.emulateMedia({ colorScheme: 'light' });
  await expect(settings.locator('html')).toHaveClass(/pf-light/);
  const light = await settings.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).not.toBe(dark);
  expect(light).toBe('rgb(250, 250, 249)');

  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: 'light' });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('html')).toHaveClass(/pf-light/);
});
