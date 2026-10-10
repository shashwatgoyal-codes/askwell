import '@/assets/theme.css';
import { createRoot, type Root } from 'react-dom/client';
import { createShadowRootUi } from '#imports';
import { MATCHES, siteFor } from '@/lib/sites';
import { Coach } from '@/components/coach/Coach';

export default defineContentScript({
  matches: MATCHES,
  cssInjectionMode: 'ui',
  async main(ctx) {
    const site = siteFor(location.hostname);
    if (!site) return;

    // A shadow root keeps the host page's CSS out of the coach and ours out
    // of the page. isolateEvents stops keystrokes in the panel from reaching
    // the site's own shortcuts.
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'preflight-coach',
      position: 'inline',
      anchor: 'body',
      isolateEvents: true,
      onMount(container) {
        const root = createRoot(container);
        root.render(<Coach site={site} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
