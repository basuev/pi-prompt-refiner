export const REQUESTED_REFINE_MODES = ["auto", "continuation", "standalone"] as const;
export const DELIVERY_MODES = ["continuation", "standalone"] as const;
export const DEFAULT_REQUESTED_MODE = "auto" as const;
export const SUMMARY_WORD_LIMIT = 300;

export type RequestedRefineMode = (typeof REQUESTED_REFINE_MODES)[number];
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export interface ParsedCommandArgs {
	input: string;
	mode: RequestedRefineMode;
	unknownOption?: string;
}

export interface RefinementPlan {
	mode: DeliveryMode;
	useSessionContext: boolean;
}

export function parseCommandArgs(args: string): ParsedCommandArgs {
	const trimmed = args.trim();
	const modeMatch = trimmed.match(/^--(auto|continuation|standalone)(?:\s+|$)/);
	if (modeMatch) {
		return {
			input: trimmed.slice(modeMatch[0].length).trim(),
			mode: modeMatch[1] as RequestedRefineMode,
		};
	}
	const optionMatch = trimmed.match(/^(--\S+)/);
	return {
		input: trimmed,
		mode: DEFAULT_REQUESTED_MODE,
		unknownOption: optionMatch?.[1],
	};
}

export function explicitRefinementPlan(mode: RequestedRefineMode): RefinementPlan | undefined {
	if (mode === "auto") return undefined;
	return { mode, useSessionContext: mode === "standalone" };
}

export function parseAutoRefinementPlan(output: string): RefinementPlan {
	let parsed: unknown;
	try {
		parsed = JSON.parse(output.trim());
	} catch {
		throw new Error(`GPT-5.6 Luna returned an invalid refinement plan: ${output}`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`GPT-5.6 Luna returned an invalid refinement plan: ${output}`);
	}
	const record = parsed as Record<string, unknown>;
	const keys = Object.keys(record);
	if (
		keys.length !== 1 ||
		keys[0] !== "mode" ||
		(record.mode !== "continuation" && record.mode !== "standalone")
	) {
		throw new Error(`GPT-5.6 Luna returned an invalid refinement plan: ${output}`);
	}
	return { mode: record.mode, useSessionContext: false };
}

export function buildRouteInput(prompt: string): string {
	return JSON.stringify({ promptToClassify: prompt }, null, 2);
}

export function buildSummaryInput(prompt: string, transcript: string): string {
	return JSON.stringify(
		{
			promptBeingRefined: prompt,
			conversationTranscript: transcript,
		},
		null,
		2,
	);
}

export function buildRefinementInput(
	prompt: string,
	mode: DeliveryMode,
	conversationSummary?: string,
): string {
	if (mode === "continuation" && conversationSummary !== undefined) {
		throw new Error("Continuation refinement must not receive private conversation background");
	}
	return JSON.stringify(
		{
			deliveryMode: mode,
			promptToRefine: prompt,
			...(conversationSummary === undefined
				? {}
				: { privateConversationBackground: conversationSummary }),
		},
		null,
		2,
	);
}

export function wordCount(text: string): number {
	const words = text.trim().match(/\S+/g);
	return words?.length ?? 0;
}

export function assertWordLimit(text: string, limit = SUMMARY_WORD_LIMIT): void {
	const count = wordCount(text);
	if (count > limit) throw new Error(`Context brief exceeded ${limit} words (received ${count})`);
}
