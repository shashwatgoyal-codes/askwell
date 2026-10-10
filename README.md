# Askwell

Browser tools for asking AI well, by Shashwat Goyal.

## Preflight

Checks your prompt before you send it. On claude.ai, chatgpt.com and gemini.google.com it points out
what is missing (the goal, the error, the constraints, the shape of the answer you want, or context
the AI can't see) and coaches the habits that cost the most time, like sending errors one at a time.

The checks run in your browser. AI is used only when you ask for a rewrite, with your own API key,
which never leaves the extension.

## Develop

Requires Node 22+ and pnpm.

```
pnpm install
pnpm dev
```

## Install a build

```
pnpm build
```

Chrome, Brave or Edge: open the extensions page, turn on Developer mode, choose **Load unpacked** and
pick `apps/preflight/.output/chrome-mv3`.
