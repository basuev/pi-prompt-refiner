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

Run the command with an inline prompt:

```text
/refine-prompt fix the login bug we discussed
```

Run the command without arguments to open an editor:

```text
/refine-prompt
```

Invoke the skill explicitly:

```text
/skill:refine-prompt make this request precise
```

The skill can also load when you ask Pi to refine, improve, rewrite, or optimize a prompt.

The command places the refined prompt in the Pi editor. The skill returns it in a Markdown code block.

## Session context

When the active branch contains earlier messages, the extension runs two Luna calls:

1. Luna at `medium` condenses relevant session context into a brief of at most 300 words.
2. Luna at `high` refines the supplied prompt with that brief as background knowledge.

The context brief helps Luna resolve references such as "make the change we discussed." Luna does not copy session details into a prompt that already stands on its own.

Context preparation:

- excludes the current skill invocation;
- respects Pi compaction summaries;
- preserves the beginning and recent end of long transcripts;
- caps the source transcript at 60,000 characters;
- skips the summary call when the session has no earlier context.

## Luna thinking levels

Prompt refinement starts with `high`. If that call fails, the extension tries only other GPT-5.6 Luna thinking levels in this order:

```text
high, xhigh, medium, low, minimal, off
```

The extension never uses `max` and never falls back to another model.

Check every configured Luna thinking level against your current Codex subscription:

```text
/refine-prompt-efforts
```

## Prompt rules

The refiner preserves the user's intent, facts, constraints, language, and requested autonomy. It applies Codex prompting practices selectively:

- lead with the desired behavior or outcome;
- retain relevant files, symbols, logs, screenshots, and reproduction steps;
- separate observed and expected behavior for bugs;
- make scope boundaries and deliverables explicit;
- add verification when it helps the target task;
- avoid invented repository facts, paths, commands, or acceptance criteria.

The complete rules live in [`skills/refine-prompt/references/refiner-system-prompt.md`](skills/refine-prompt/references/refiner-system-prompt.md).

## Configuration

The current package keeps model and context settings in [`extensions/refine-prompt/index.ts`](extensions/refine-prompt/index.ts):

- model: `openai-codex/gpt-5.6-luna`;
- summary level: `medium`;
- initial refinement level: `high`;
- summary limit: 300 words;
- transcript limit: 60,000 characters;
- child Pi timeout: 10 minutes.

The package has no runtime configuration file.

## How it runs Luna

Each delegated call starts an isolated child Pi process with tools, extensions, skills, and session persistence disabled. This uses the same Codex-subscription route as selecting Luna in Pi and prevents recursive extension loading.

The extension sends the relevant conversation transcript to GPT-5.6 Luna when session context exists. Do not use context-aware refinement for conversations that contain data you cannot send through your Codex subscription.

## Verify a checkout

Load only the resources from the checkout:

```sh
pi --no-extensions --no-skills \
  --extension ./extensions/refine-prompt/index.ts \
  --skill ./skills/refine-prompt
```

Then run:

```text
/refine-prompt-efforts
```

For a context check, establish a constraint in one turn and refine a context-dependent request in the next:

```text
/skill:refine-prompt make the change we discussed
```

Confirm that the result carries required constraints from the conversation. Then refine a standalone request and confirm that unrelated session details do not appear.

## Package layout

```text
extensions/refine-prompt/index.ts
skills/refine-prompt/SKILL.md
skills/refine-prompt/references/refiner-system-prompt.md
```

`package.json` registers both resource directories as one Pi package. Pi provides the runtime peer dependencies.

## License

MIT. See [LICENSE](LICENSE).
