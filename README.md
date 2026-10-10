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

## Privacy

- The checks run inside your browser. Preflight has no server, no account and no analytics.
- Your API key is stored only in the extension's local storage on your device.
- Text leaves your browser only when you click **Improve** or **Summary**, and then it goes only to the
  AI provider whose key you entered, under that provider's terms.
- Preflight never sends a message for you. It can fill the chat box; you always press Send.

## Not affiliated

Preflight works alongside ChatGPT, Claude and Gemini but is not affiliated with, endorsed by or
sponsored by OpenAI, Anthropic or Google. Those names belong to their owners and are used here only
to say which sites Preflight works with.

## License

The code is released under the [MIT License](LICENSE). It is provided as is, without warranty.

The license covers the code only. The names Askwell and Preflight and their logos are not licensed
for reuse; a fork should use its own name and logo.
