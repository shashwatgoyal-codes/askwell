# Store listing: Preflight

Everything both stores ask for, ready to paste. Screenshots are in `store/screenshots/` at 1280×800.
The package to upload is attached to each GitHub release: `preflight-<version>-firefox.zip` for
Firefox, `preflight-<version>-chrome.zip` for Edge.

## Name

Preflight

## Summary (short description, 132 characters or fewer)

Checks your AI prompt before you send it: flags the missing error, goal or context in ChatGPT, Claude, Gemini and more.

## Description

Preflight reads the prompt you are typing into an AI chat and points out what is missing before you
press Send: the error you meant to paste, what "working" should look like, the context the AI can't
see. Most wasted AI answers come from a prompt that read as complete to the person who wrote it.

- Gaps as you type: a small badge counts what is missing; click it for each gap and how to fix it.
- Improve, with your own API key (Anthropic, OpenAI or Gemini): a rewrite that closes the gaps, shown as
  a diff with the reason for every addition. You apply it; you always press Send.
- Conversation coaching: notices errors sent one at a time, the same fix asked for again and again, and
  a new chat that assumes the last one, and offers a template.
- Your own rules, a prompt library, and a weekly view of how many gaps you catch.

Works on ChatGPT, Claude, Gemini, Perplexity, Copilot, Grok, DeepSeek and Le Chat. The checks run in
your browser with no account and no analytics; text is sent only when you click Improve, and only to
the provider whose key you entered.

Open source (MIT): https://github.com/shashwatgoyal-codes/askwell

Preflight is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google, Microsoft,
Perplexity, xAI, DeepSeek or Mistral.

## Category

Firefox: Other. Edge: Productivity.

## Privacy policy URL

https://github.com/shashwatgoyal-codes/askwell/blob/main/PRIVACY.md

## Homepage / support URL

https://github.com/shashwatgoyal-codes/askwell

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Keeps settings, the optional API key, the library and daily counts on the device. |
| `activeTab` | Lets the popup see which site the current tab is on, to show its on/off switch. |
| Host access to the supported chat sites | Reads the prompt being typed there and shows the badge beside it. |
| Host access to api.anthropic.com, api.openai.com, generativelanguage.googleapis.com | Sends a prompt for Improve to the provider whose key the person entered, only when they click Improve. |

## Data collection (Firefox)

Declared in the manifest as `websiteContent`: when the person clicks Improve, the prompt they typed is
sent to the AI provider they chose. Nothing else leaves the browser.

## Notes for reviewers

- The source is public and the build is reproducible: `pnpm install && pnpm zip` from the repository
  root, with Node 22+ and pnpm 10. The sources zip is also attached to each release.
- No remote code is loaded. The bundled provider SDKs are the official Anthropic, OpenAI and Google
  libraries, used only from the background worker.
- To test Improve without a key, the checks and badge work on their own; Improve needs any API key.
