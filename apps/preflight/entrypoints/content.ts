import { runChecks } from '@askwell/rules';

export default defineContentScript({
  matches: ['https://claude.ai/*', 'https://chatgpt.com/*', 'https://gemini.google.com/*'],
  main() {
    // The badge is mounted here next. For now this proves the rules package
    // loads inside the host page.
    console.debug('[Preflight] ready', runChecks('').length);
  },
});
