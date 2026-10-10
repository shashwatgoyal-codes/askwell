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

## Install

Download the zip for your browser from the [latest release](https://github.com/shashwatgoyal-codes/askwell/releases),
or build it yourself with `pnpm zip` (files land in `apps/preflight/dist`).

- **Chrome, Brave or Edge:** unzip `preflight-<version>-chrome.zip`, open the extensions page, turn on
  Developer mode, choose **Load unpacked** and pick the unzipped folder.
- **Firefox:** install the signed `.xpi` from the release if there is one. Otherwise open
  `about:debugging` → This Firefox → **Load Temporary Add-on** and pick the Firefox zip; Firefox removes
  temporary add-ons when it restarts.

Then open Preflight's settings and add an API key if you want Improve. The checks work without one.

## Release

Bump `version` in `apps/preflight/package.json`, commit, then tag and push:

```
git tag preflight-v0.1.0
git push origin preflight-v0.1.0
```

The Release workflow checks the tag matches the version, runs the tests and attaches the zips to a
GitHub release. With the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets set, it also signs
the Firefox build as unlisted (signed by Mozilla, not listed publicly) so it installs permanently.

## Privacy

- The checks run inside your browser. Preflight has no server, no account and no analytics.
- Your API key is stored only in the extension's local storage on your device.
- Text leaves your browser only when you click **Improve**, and then it goes only to the AI provider
  whose key you entered, under that provider's terms. The end-of-session summary is asked of the chat
  you are already in, so it sends nothing anywhere new.
- Today's counts in the popup are numbers only; your prompts are never stored.
- Preflight never sends a message for you. It can fill the chat box; you always press Send.

## Not affiliated

Preflight works alongside ChatGPT, Claude and Gemini but is not affiliated with, endorsed by or
sponsored by OpenAI, Anthropic or Google. Those names belong to their owners and are used here only
to say which sites Preflight works with.

## License

The code is released under the [MIT License](LICENSE). It is provided as is, without warranty.

The license covers the code only. The names Askwell and Preflight and their logos are not licensed
for reuse; a fork should use its own name and logo.
