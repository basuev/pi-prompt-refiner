#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const fixtures = JSON.parse(readFileSync(resolve(root, "evals/fixtures.json"), "utf8"));
const systemPrompt = readFileSync(
  resolve(root, "skills/refine-prompt/references/refiner-system-prompt.md"),
  "utf8",
);
const selectedIds = args.fixtures ? new Set(args.fixtures.split(",")) : undefined;
const selectedFixtures = selectedIds
  ? fixtures.filter((fixture) => selectedIds.has(fixture.id))
  : fixtures;
if (selectedIds && selectedFixtures.length !== selectedIds.size) {
  const found = new Set(selectedFixtures.map((fixture) => fixture.id));
  const missing = [...selectedIds].filter((id) => !found.has(id));
  throw new Error(`Unknown fixtures: ${missing.join(", ")}`);
}

const efforts = args.efforts.split(",").map((effort) => effort.trim()).filter(Boolean);
const results = [];
let hardFailures = 0;

for (const effort of efforts) {
  for (let repeat = 1; repeat <= args.repeat; repeat++) {
    for (const fixture of selectedFixtures) {
      const input = JSON.stringify(
        {
          deliveryMode: fixture.mode,
          promptToRefine: fixture.prompt,
          ...(fixture.background && fixture.mode === "standalone"
            ? { privateConversationBackground: fixture.background }
            : {}),
        },
        null,
        2,
      );
      const startedAt = performance.now();
      const child = spawnSync(
        "pi",
        [
          "--print",
          "--no-session",
          "--no-tools",
          "--no-extensions",
          "--no-skills",
          "--model",
          `openai-codex/gpt-5.6-luna:${effort}`,
          "--system-prompt",
          systemPrompt,
          input,
        ],
        { encoding: "utf8", timeout: args.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      );
      const durationMs = Math.round(performance.now() - startedAt);
      const output = child.stdout?.trim() ?? "";
      const error =
        child.error?.message ||
        (child.status === 0 ? undefined : child.stderr?.trim() || `exit ${child.status}`);
      const assertions = error ? [{ ok: false, message: error }] : scoreFixture(fixture, output);
      const ok = assertions.every((assertion) => assertion.ok);
      if (!ok) hardFailures++;
      const result = {
        fixture: fixture.id,
        effort,
        repeat,
        ok,
        durationMs,
        output,
        assertions,
      };
      results.push(result);
      process.stdout.write(`${ok ? "PASS" : "FAIL"} ${effort} ${fixture.id} (${durationMs}ms)\n`);
      for (const assertion of assertions.filter((item) => !item.ok)) {
        process.stdout.write(`  - ${assertion.message}\n`);
      }
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  model: "openai-codex/gpt-5.6-luna",
  systemPromptSha256: createHash("sha256").update(systemPrompt).digest("hex"),
  efforts,
  repeat: args.repeat,
  results,
};
if (args.output) {
  const outputPath = resolve(process.cwd(), args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Report: ${outputPath}\n`);
}

const byEffort = new Map();
for (const result of results) {
  const summary = byEffort.get(result.effort) ?? { passed: 0, total: 0, durationMs: 0 };
  summary.total++;
  summary.durationMs += result.durationMs;
  if (result.ok) summary.passed++;
  byEffort.set(result.effort, summary);
}
for (const [effort, summary] of byEffort) {
  process.stdout.write(
    `${effort}: ${summary.passed}/${summary.total} hard-gate passes, ` +
      `${Math.round(summary.durationMs / summary.total)}ms mean latency\n`,
  );
}
process.stdout.write("Review semantic quality manually; hard gates do not measure invented scope or overall prompt quality.\n");
process.exitCode = hardFailures === 0 ? 0 : 1;

function scoreFixture(fixture, output) {
  const normalized = output.toLocaleLowerCase("en-US");
  const normalizedPlain = normalized.replace(/[`*_]/g, "");
  const assertions = [];
  for (const required of fixture.requiredAll ?? []) {
    assertions.push({
      ok: normalized.includes(required.toLocaleLowerCase("en-US")),
      message: `missing required text: ${required}`,
    });
  }
  for (const alternatives of fixture.requiredAny ?? []) {
    assertions.push({
      ok: alternatives.some((value) => normalized.includes(value.toLocaleLowerCase("en-US"))),
      message: `missing every required alternative: ${alternatives.join(" | ")}`,
    });
  }
  for (const pattern of fixture.requiredPatterns ?? []) {
    assertions.push({
      ok: new RegExp(pattern, "is").test(normalizedPlain),
      message: `missing required relationship: /${pattern}/`,
    });
  }
  for (const forbidden of fixture.forbidden ?? []) {
    assertions.push({
      ok: !normalized.includes(forbidden.toLocaleLowerCase("en-US")),
      message: `contains forbidden text: ${forbidden}`,
    });
  }
  for (const pattern of fixture.forbiddenPatterns ?? []) {
    assertions.push({
      ok: !new RegExp(pattern, "is").test(normalizedPlain),
      message: `contains forbidden relationship: /${pattern}/`,
    });
  }
  if (fixture.maxWords !== undefined) {
    const words = output.match(/\S+/g)?.length ?? 0;
    assertions.push({
      ok: words <= fixture.maxWords,
      message: `expected at most ${fixture.maxWords} words, received ${words}`,
    });
  }
  return assertions;
}

function parseArgs(argv) {
  const parsed = {
    efforts: "medium,high",
    fixtures: undefined,
    repeat: 1,
    output: undefined,
    timeoutMs: 600_000,
  };
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === "--efforts" && value) parsed.efforts = value;
    else if (option === "--fixtures" && value) parsed.fixtures = value;
    else if (option === "--repeat" && value) parsed.repeat = Number.parseInt(value, 10);
    else if (option === "--output" && value) parsed.output = value;
    else if (option === "--timeout-ms" && value) parsed.timeoutMs = Number.parseInt(value, 10);
    else throw new Error(`Unknown or incomplete option: ${option}`);
    index++;
  }
  if (!Number.isInteger(parsed.repeat) || parsed.repeat < 1) throw new Error("--repeat must be a positive integer");
  return parsed;
}
