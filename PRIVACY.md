# Preflight privacy policy

_Last updated: 10 October 2026_

Preflight is a browser extension by Shashwat Goyal that checks prompts typed into AI chat sites. This
policy says what it does with your data. The short version: it has no server, no account and no
analytics, and it sends text only when you ask it to.

## What Preflight reads

- **The prompt you are typing** into a supported AI chat site (ChatGPT, Claude, Gemini, Perplexity,
  Copilot, Grok, DeepSeek and Le Chat), to check it as you type.
- **Your own earlier messages in the open chat**, on sites where Preflight can find them, to notice
  habits such as sending errors one at a time.

Both are read inside your browser and are not stored, except as described below.

## What Preflight stores

Everything is kept in the extension's local storage on your device, and nowhere else:

- Your settings: sensitivity, which checks and sites are on, your own rules.
- Your API key(s), if you add one for Improve, and the model you chose.
- An admin token and its portal address, if you add one.
- Prompts you choose to save to your library. Nothing is saved there unless you click Save.
- Daily counts: how many prompts were checked and which kinds of gaps were found. Numbers only; the
  text of your prompts is never stored.

Clearing local data in Preflight's settings, or removing the extension, deletes all of it.

## What Preflight sends, and to whom

Nothing is sent anywhere unless you click **Improve**. Then:

- With your own key, the prompt and the list of gaps found are sent to the AI provider whose key you
  entered (Anthropic, OpenAI or Google), directly from your browser, under that provider's terms.
- With an admin token, they are sent to the Askwell portal whose address you entered, which forwards
  them to Anthropic on its owner's key. The portal keeps a count of uses per token per day and nothing
  else about the request.

Your API key is sent only to the provider it belongs to. Preflight never sends a message in a chat for
you; it can fill the chat box, and you always press Send.

## What Preflight does not do

- No analytics, tracking, advertising or profiling.
- No selling or sharing of data with anyone.
- No reading of pages other than the supported AI chat sites.

## Contact

Questions about this policy: open an issue at https://github.com/shashwatgoyal-codes/askwell/issues.

Preflight is not affiliated with, endorsed by or sponsored by OpenAI, Anthropic, Google, Microsoft,
Perplexity, xAI, DeepSeek or Mistral.
