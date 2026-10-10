import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { CHROME_PUBLIC_KEY } from './extension-key';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  zip: {
    artifactTemplate: 'preflight-{{version}}-{{browser}}.zip',
    sourcesTemplate: 'preflight-{{version}}-sources.zip',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Preflight',
    description: 'Checks your AI prompt before you send it. By Askwell.',
    homepage_url: 'https://github.com/shashwatgoyal-codes',
    permissions: ['storage'],
    // Improve calls the provider whose key the user entered, from the
    // background worker only.
    host_permissions: [
      'https://api.anthropic.com/*',
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
    ...(browser === 'chrome' || browser === 'edge' ? { key: CHROME_PUBLIC_KEY } : {}),
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'preflight@askwell' } } }
      : {}),
  }),
});
