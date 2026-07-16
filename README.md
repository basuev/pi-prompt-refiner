# Pi Prompt Refiner

Pi Prompt Refiner turns rough coding requests into ready-to-send Codex prompts. It uses GPT-5.6 Luna through your Codex subscription and can interpret short requests against the current Pi conversation.

## Requirements

- Pi installed and available as `pi` on `PATH`
- an active Codex subscription authenticated in Pi
- access to `openai-codex/gpt-5.6-luna`

The extension does not use an OpenAI API key or another model provider.

## Install

Install the package from GitHub:

```sh
pi install git:github.com/basuev/pi-prompt-refiner
```

Reload an active Pi session:

```text
/reload
```

To install a local checkout instead:

```sh
pi install /absolute/path/to/pi-prompt-refiner
```

Pi packages execute with your user permissions. Review the extension and skill before installing them.

## Use

Run the command with an inline prompt. It defaults to automatic mode selection:

```text
/refine-prompt fix the login bug we discussed
```

Create a portable prompt for a new conversation:

```text
/refine-prompt --standalone fix the login bug we discussed
```

Use `--continuation` or `--standalone` to override automatic selection. Use `--auto` to select the default explicitly.

Run the command without arguments to open an editor:

```text
/refine-prompt
```

Invoke the skill explicitly:

```text
/skill:refine-prompt make this request precise
```

The skill can also load when you ask Pi to refine, improve, rewrite, or optimize a prompt.

The command places the refined prompt in the Pi editor. The skill returns it in a Markdown code block. Both use automatic mode selection unless you request a mode explicitly.

## Delivery modes

`auto` selects `standalone` only when the request explicitly asks for a portable prompt for a new conversation, another agent, sharing, or later reuse. It selects `continuation` for every other request, including detailed and self-contained prompts, because the result normally returns to the current Pi session. An auto-selected standalone prompt does not import session context.

`continuation` targets the current conversation. Luna preserves every explicit fact and requirement in the prompt being refined while leaving earlier-session details implicit for the target agent to resolve from its existing history.

`standalone` targets a new conversation. When selected explicitly, Luna carries the contextual facts and requirements needed to make the result actionable without the original history.

## Session context

Automatic selection first uses Luna at `minimal` to choose a delivery mode. Continuation prompts are refined without copying session background into the delegated call: the target agent already sees the current conversation, and retaining indirect references avoids both duplication and context leakage. Auto-selected standalone prompts also skip session context so an inline portability request cannot silently import unrelated history.

An explicit mode skips the routing call. Explicit continuation requires one refinement call. Explicit standalone can use two Luna calls when earlier session context exists:

1. Luna at `medium` condenses relevant session context into a brief of at most 300 words.
2. Luna at `medium` turns the supplied prompt and necessary brief facts into a portable prompt.

Use explicit standalone when a context-dependent request such as "make the change we discussed" must become independently actionable outside the current conversation.

Context preparation:

- excludes the current skill invocation;
- respects Pi compaction summaries;
- preserves the beginning and recent end of long transcripts;
- caps the source transcript at 60,000 characters;
- skips the summary call when the session has no earlier context.

## Luna thinking levels

Prompt refinement starts with `medium`, selected after comparing the live eval corpus against `high`. If that call fails, the extension tries only other GPT-5.6 Luna thinking levels in this order:

```text
medium, high, xhigh, low, minimal, off
```

The extension never uses `max` and never falls back to another model.

Check every configured Luna thinking level against your current Codex subscription:

```text
/refine-prompt-efforts
```

## Design source

The prompt-refinement rules are based on OpenAI's [Prompting Codex](https://learn.chatgpt.com/docs/prompting#prompting-codex) guide and the current [GPT-5.6 prompting guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6), reviewed on July 16, 2026.

The guides informed the outcome-first, lean-prompt, constraint, evidence, completion, and verification rules. They did not define the Pi package structure, delivery modes, session summarization, compaction handling, transcript limit, Luna execution path, or thinking-level fallback. Those are implementation choices in this project.

## Prompt rules

The refiner preserves the user's intent, facts, constraints, language, and requested autonomy. It applies the sourced Codex prompting practices when they improve the request:

- lead with the desired behavior or outcome;
- retain relevant files, symbols, logs, screenshots, reproduction steps, evidence, and examples;
- separate observed and expected behavior for bugs;
- make supplied constraints, scope boundaries, deliverables, success criteria, and stop rules explicit;
- add only the smallest relevant validation needed to define implementation completion;
- avoid invented process, repository facts, paths, commands, evaluation criteria, or acceptance criteria;
- keep short, already-clear prompts short.

The complete rules live in [`skills/refine-prompt/references/refiner-system-prompt.md`](skills/refine-prompt/references/refiner-system-prompt.md).

## Configuration

The current package keeps model and context settings in [`extensions/refine-prompt/index.ts`](extensions/refine-prompt/index.ts):

- model: `openai-codex/gpt-5.6-luna`;
- summary level: `medium`;
- default requested mode: `auto`;
- automatic delivery-mode routing level: `minimal`;
- initial refinement level: `medium`;
- summary limit: 300 words;
- transcript limit: 60,000 characters;
- child Pi timeout: 10 minutes.

The package has no runtime configuration file.

## How it runs Luna

Each delegated call starts an isolated child Pi process with tools, extensions, skills, and session persistence disabled. This uses the same Codex-subscription route as selecting Luna in Pi and prevents recursive extension loading.

The extension sends conversation data to GPT-5.6 Luna only for explicit standalone refinement. Dynamic prompt and conversation fields are serialized as JSON user data rather than interpolated into the system prompt. Do not use explicit context-aware standalone refinement for conversations that contain data you cannot send through your Codex subscription.

## Verify a checkout

Load only the resources from the checkout:

```sh
pi --no-extensions --no-skills \
  --extension ./extensions/refine-prompt/index.ts \
  --skill ./skills/refine-prompt
```

Run deterministic tests:

```sh
npm test
```

Then run the subscription availability probe:

```text
/refine-prompt-efforts
```

Compare Luna refinement quality at `medium` and `high` with the live hard-gate corpus:

```sh
npm run eval:live -- --efforts medium,high --output evals/results/latest.json
```

Live evals are nondeterministic and require manual semantic review; hard gates catch fact loss, context leakage, scope-boundary violations, and prompt-injection canaries but do not fully measure prompt quality.

For a context check, establish a constraint in one turn and refine a context-dependent request in the next:

```text
/skill:refine-prompt make the change we discussed
```

Confirm that auto mode selects continuation and retains the indirect reference without restating the conversation. Refine a detailed self-contained request and confirm that continuation preserves every explicit detail. Then refine a context-dependent request with explicit standalone mode and confirm that necessary facts become portable while unrelated history stays out. Finally, request a self-contained portable prompt inline and confirm that auto mode selects standalone without importing session details.

## Package layout

```text
extensions/refine-prompt/core.ts
extensions/refine-prompt/index.ts
evals/fixtures.json
evals/run.mjs
skills/refine-prompt/SKILL.md
skills/refine-prompt/references/refiner-system-prompt.md
tests/core.test.ts
```

`package.json` registers both resource directories as one Pi package. Pi provides the runtime peer dependencies.

## License

MIT. See [LICENSE](LICENSE).
