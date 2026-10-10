export default defineBackground(() => {
  // Content scripts can't open the settings page themselves.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if ((message as { type?: string })?.type === 'open-settings') {
      void browser.runtime.openOptionsPage();
    }
  });

  // Provider calls for Improve and session summaries will run here, so the
  // user's key is used from one place and never touches a page's scripts.
});
