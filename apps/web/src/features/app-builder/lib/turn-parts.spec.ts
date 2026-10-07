import type { BuilderTurnMode, TurnStreamPhase } from "@wandit/contracts";
import type { DynamicToolUIPart, JSONValue } from "ai";
import { describe, expect, it, vi } from "vitest";

import type {
	BuilderDataParts,
	BuilderDiffLine,
	BuilderEditArea,
	BuilderMessage,
	BuilderMessagePart,
	BuilderStepKind,
	BuilderStepState,
	TurnMessage,
	TurnMessagePart,
} from "../api/dto";
import {
	type LiveStatus,
	latestTurnModeOf,
	livePhaseOf,
	liveStatusOf,
	receiptOf,
	stepOf,
	toBuilderMessages,
	workedDurationOf,
} from "./turn-parts";

const IDLE = { isRunning: false };
const RUNNING = { isRunning: true };

/** A finished call of one tool, as the harness streams it. */
function doneCall(
	toolName: string,
	input: Record<string, string>,
	output: JSONValue = {},
): DynamicToolUIPart {
	return {
		type: "dynamic-tool",
		toolName,
		toolCallId: `call-${toolName}`,
		state: "output-available",
		input,
		output,
	};
}

/** The data-step parts of the first message, in order. */
function stepsOf(messages: TurnMessage[], options = IDLE) {
	return toBuilderMessages(messages, options)[0].parts.flatMap((part) =>
		part.type === "data-step" ? [part.data] : [],
	);
}

/** The output of a Read of a PNG file, as Claude Code returns it. */
const PNG_READ_OUTPUT = {
	type: "image",
	file: { base64: "iVBORw0KGgo=", type: "image/png" },
};

describe("stepOf", () => {
	it.each<{
		toolName: string;
		input: Record<string, string>;
		target: string;
		detail: BuilderDiffLine[];
	}>([
		{
			toolName: "edit",
			input: {
				file_path: "src/styles.css",
				old_string: "a {}",
				new_string: "a { color: red; }",
			},
			target: "styles.css",
			detail: [
				{ kind: "remove", text: "a {}" },
				{ kind: "add", text: "a { color: red; }" },
			],
		},
		{
			toolName: "write",
			input: { file_path: "src/app.tsx", content: "one\ntwo" },
			target: "app.tsx",
			detail: [
				{ kind: "add", text: "one" },
				{ kind: "add", text: "two" },
			],
		},
	])("shows a $toolName call as an edit row with the file name and the diff lines", ({
		toolName,
		input,
		target,
		detail,
	}) => {
		expect(stepOf(doneCall(toolName, input), false)).toMatchObject({
			kind: "edit",
			state: "done",
			target,
			description: null,
			detail,
		});
	});

	it("cuts a long detail to 40 lines and one ellipsis line", () => {
		const content = Array.from({ length: 50 }, (_, index) => `line ${index}`);
		const step = stepOf(
			doneCall("write", { file_path: "a.ts", content: content.join("\n") }),
			false,
		);
		expect(step?.detail).toHaveLength(41);
		expect(step?.detail.at(-1)).toEqual({ kind: "context", text: "…" });
	});

	// The first rule that matches wins, so the order of the rules matters.
	it.each<{ toolName: string; path: string; area: BuilderEditArea | null }>([
		{ toolName: "edit", path: "src/styles/global.css", area: "styles" },
		{
			toolName: "edit",
			path: "/vercel/sandbox/src/routes/index.tsx",
			area: "pages",
		},
		{ toolName: "write", path: "src/app/(tabs)/index.tsx", area: "pages" },
		// A chat app often has a "messages" route; it is a page, not the texts.
		{ toolName: "edit", path: "src/routes/messages/index.tsx", area: "pages" },
		{ toolName: "edit", path: "src/components/hero.tsx", area: "components" },
		{ toolName: "edit", path: "src/shared/ui/button.tsx", area: "components" },
		{ toolName: "edit", path: "src/i18n/fr.ts", area: "texts" },
		{
			toolName: "write",
			path: "supabase/migrations/001_init.sql",
			area: "database",
		},
		// An edge function is server code, not the database.
		{
			toolName: "write",
			path: "supabase/functions/send-mail/index.ts",
			area: "code",
		},
		{ toolName: "edit", path: "package.json", area: "settings" },
		{ toolName: "edit", path: "vite.config.ts", area: "settings" },
		{ toolName: "write", path: "public/hero.png", area: "images" },
		{ toolName: "edit", path: "src/lib/use-load.ts", area: "code" },
		{ toolName: "read", path: "src/styles/global.css", area: null },
	])("gives the $toolName of $path the area $area", ({
		toolName,
		path,
		area,
	}) => {
		expect(stepOf(doneCall(toolName, { file_path: path }), false)?.area).toBe(
			area,
		);
	});

	// The details panel puts the URL in an <img> src, so only safe images pass.
	it.each<{
		name: string;
		toolName: string;
		output: JSONValue;
		imageUrl: string | null;
	}>([
		{
			name: "a read of a PNG file as a data URL",
			toolName: "read",
			output: PNG_READ_OUTPUT,
			imageUrl: "data:image/png;base64,iVBORw0KGgo=",
		},
		{
			name: "no image for a read of an SVG file",
			toolName: "read",
			output: {
				type: "image",
				file: { base64: "PHN2Zz4=", type: "image/svg+xml" },
			},
			imageUrl: null,
		},
		{
			name: "no image for base64 with a quote in it",
			toolName: "read",
			output: {
				type: "image",
				file: { base64: 'iVBOR"onerror="x', type: "image/png" },
			},
			imageUrl: null,
		},
		{
			name: "the https URL of a generated image",
			toolName: "generate_image",
			output: {
				status: "generated",
				url: "https://images.example.com/hero.png",
				width: 1024,
				height: 1024,
				path: "public/hero.png",
			},
			imageUrl: "https://images.example.com/hero.png",
		},
		{
			name: "no image for a generated image on http",
			toolName: "generate_image",
			output: {
				status: "generated",
				url: "http://images.example.com/hero.png",
				width: 1024,
				height: 1024,
				path: "public/hero.png",
			},
			imageUrl: null,
		},
		{
			name: "no image for a javascript URL",
			toolName: "generate_image",
			output: {
				status: "generated",
				url: "javascript:alert(1)",
				width: 1024,
				height: 1024,
				path: "public/hero.png",
			},
			imageUrl: null,
		},
		{
			name: "no image for a failed generation",
			toolName: "generate_image",
			output: { status: "failed", message: "no credits" },
			imageUrl: null,
		},
	])("gives $name", ({ toolName, output, imageUrl }) => {
		expect(stepOf(doneCall(toolName, {}, output), false)?.imageUrl).toBe(
			imageUrl,
		);
	});

	// Safari 16 has no URL.canParse. One call to it crashes the whole builder page.
	it("reads an image URL and a web host without URL.canParse", () => {
		const canParse = vi.spyOn(URL, "canParse").mockImplementation(() => {
			throw new TypeError("URL.canParse is not a function");
		});
		try {
			const image = doneCall(
				"generate_image",
				{},
				{
					status: "generated",
					url: "https://images.example.com/hero.png",
					width: 1024,
					height: 1024,
					path: "public/hero.png",
				},
			);
			const fetch = doneCall("WebFetch", {
				url: "https://docs.example.com/guide",
			});
			expect(stepOf(image, false)?.imageUrl).toBe(
				"https://images.example.com/hero.png",
			);
			expect(stepOf(fetch, false)?.target).toBe("docs.example.com");
		} finally {
			canParse.mockRestore();
		}
	});

	// A host tool reports a failure or a pause as a normal output with a status.
	it.each<{
		toolName: string;
		input: Record<string, string>;
		output: Record<string, string>;
		kind: BuilderStepKind;
		state: BuilderStepState;
		/** The one detail line: the SQL or the image prompt of the input. */
		detailText: string;
	}>([
		{
			toolName: "apply_migration",
			input: { name: "notes", sql: "create table notes ();" },
			output: { status: "applied", file: "supabase/migrations/1_notes.sql" },
			kind: "database",
			state: "done",
			detailText: "create table notes ();",
		},
		{
			toolName: "generate_image",
			input: { prompt: "a cat", aspect: "1:1", path: "public/cat.png" },
			output: { status: "failed", message: "no credits" },
			kind: "image",
			state: "error",
			detailText: "a cat",
		},
		{
			toolName: "run_sql",
			input: { query: "delete from notes" },
			output: { status: "needs_approval", tool: "run_sql_write" },
			kind: "databaseCheck",
			state: "skipped",
			detailText: "delete from notes",
		},
	])("shows the $toolName status $output.status as a $state row with its input in the detail", ({
		toolName,
		input,
		output,
		kind,
		state,
		detailText,
	}) => {
		expect(stepOf(doneCall(toolName, input, output), false)).toMatchObject({
			kind,
			state,
			detail: [{ kind: "context", text: detailText }],
		});
	});

	// The tool map is a Map, so a prototype key like constructor finds no kind either.
	it.each([
		"CronCreate",
		"constructor",
	])("keeps the raw name of the unknown tool %s out of the label", (toolName) => {
		expect(stepOf(doneCall(toolName, {}), false)).toEqual({
			kind: "other",
			state: "done",
			target: null,
			description: null,
			detail: [{ kind: "context", text: toolName }],
			area: null,
			imageUrl: null,
		});
	});

	it("hides a call that waits for an approval; the approval card covers it", () => {
		expect(
			stepOf(
				{
					type: "dynamic-tool",
					toolName: "run_sql_write",
					toolCallId: "call-1",
					state: "approval-requested",
					input: { query: "delete from notes" },
					approval: { id: "ap-1" },
				},
				false,
			),
		).toBeNull();
	});

	it("runs while the turn is live and is skipped once the turn stopped", () => {
		const part: DynamicToolUIPart = {
			type: "dynamic-tool",
			toolName: "edit",
			toolCallId: "call-1",
			state: "input-available",
			input: { file_path: "src/a.ts" },
		};
		expect(stepOf(part, true)?.state).toBe("running");
		expect(stepOf(part, false)?.state).toBe("skipped");
	});

	it("adds the error text of a failed call to the detail", () => {
		const step = stepOf(
			{
				type: "dynamic-tool",
				toolName: "bash",
				toolCallId: "call-1",
				state: "output-error",
				input: { command: "pnpm lint" },
				errorText: "exit code 1",
			},
			false,
		);
		expect(step?.state).toBe("error");
		expect(step?.detail.at(-1)).toEqual({
			kind: "remove",
			text: "exit code 1",
		});
	});

	// The harness sends a shell result as an object, and a failed call as
	// JSON text in `errorText`. The row shows at most the last 2 KB.
	it.each<{ name: string; part: DynamicToolUIPart; output: BuilderDiffLine[] }>(
		[
			{
				name: "the stdout and the stderr of a finished call",
				part: doneCall(
					"bash",
					{ command: "pnpm build" },
					{ stdout: "built", stderr: "1 warning" },
				),
				output: [
					{ kind: "context", text: "built" },
					{ kind: "context", text: "1 warning" },
				],
			},
			{
				name: "the result inside the JSON error text of a failed call",
				part: {
					type: "dynamic-tool",
					toolName: "bash",
					toolCallId: "call-1",
					state: "output-error",
					input: { command: "pnpm build" },
					errorText: JSON.stringify({ stdout: "", stderr: "Type error" }),
				},
				output: [{ kind: "remove", text: "Type error" }],
			},
			{
				name: "only the last 2 KB of a long output",
				part: doneCall(
					"bash",
					{ command: "pnpm build" },
					{ stdout: `${"a".repeat(3000)}\nlast line` },
				),
				// 2048 characters: 2038 times "a", the newline, and "last line".
				output: [
					{ kind: "context", text: "…" },
					{ kind: "context", text: "a".repeat(2038) },
					{ kind: "context", text: "last line" },
				],
			},
		],
	)("shows $name after the command of a run row", ({ part, output }) => {
		expect(stepOf(part, false)?.detail).toEqual([
			{ kind: "context", text: "pnpm build" },
			...output,
		]);
	});

	// The link to the Secrets panel shows only for this answer.
	it("names the secret and flags a missing value", () => {
		expect(
			stepOf(
				doneCall(
					"set_secret",
					{ name: "STRIPE_KEY", source: "project_secret" },
					{ status: "missing", name: "STRIPE_KEY" },
				),
				false,
			),
		).toEqual({
			kind: "secret",
			state: "error",
			target: "STRIPE_KEY",
			description: null,
			detail: [],
			area: null,
			imageUrl: null,
			isSecretMissing: true,
		});
	});
});

describe("receiptOf", () => {
	it("rounds the usage centi-credits up to whole credits", () => {
		const parts = [
			{
				type: "data-turn-usage",
				id: "turn-usage",
				data: {
					inputTokens: 1200,
					outputTokens: 300,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 150,
				},
			},
		] satisfies TurnMessagePart[];
		expect(receiptOf(parts)).toEqual({
			credits: 2,
			modelId: null,
			inputTokens: 1200,
			outputTokens: 300,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		});
	});

	it("lets the done receipt win over the usage part", () => {
		const parts = [
			{
				type: "data-turn-usage",
				id: "turn-usage",
				data: {
					inputTokens: 1200,
					outputTokens: 300,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 150,
				},
			},
			{
				type: "data-turn-done",
				id: "turn-done",
				data: {
					status: "succeeded",
					receipt: {
						credits: 250,
						modelId: "anthropic/claude-sonnet-5",
						inputTokens: 1400,
						outputTokens: 500,
						cacheReadTokens: 9000,
						cacheWriteTokens: 400,
						balanceCredits: 750,
					},
				},
			},
		] satisfies TurnMessagePart[];
		expect(receiptOf(parts)).toEqual({
			credits: 3,
			modelId: "anthropic/claude-sonnet-5",
			inputTokens: 1400,
			outputTokens: 500,
			cacheReadTokens: 9000,
			cacheWriteTokens: 400,
		});
	});
});

describe("livePhaseOf", () => {
	// An old status must never show after the turn ends.
	it.each([
		{ isRunning: true, expected: "sandbox_waking" },
		{ isRunning: false, expected: null },
	])("returns $expected for the last status when isRunning is $isRunning", ({
		isRunning,
		expected,
	}) => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-turn-status",
						id: "turn-status",
						data: { phase: "sandbox_waking" },
					},
				],
			},
		] satisfies TurnMessage[];
		expect(livePhaseOf(messages, isRunning)).toBe(expected);
	});

	// A warm turn sends its first status after about 5 s. A queued turn waits
	// behind another turn, so "Getting ready" would be wrong for it.
	it.each([
		{ queued: false, expected: "session_starting" },
		{ queued: true, expected: null },
	])("returns $expected before the first status when queued is $queued", ({
		queued,
		expected,
	}) => {
		const messages = [
			{
				id: "a2",
				role: "assistant",
				parts: [
					{
						type: "data-turn-created",
						id: "turn-created",
						data: {
							chatId: "chat-1",
							runId: null,
							status: queued ? "waiting" : "queued",
							streamUrl: "/api/v2/projects/p/turns/active/stream",
							turnId: "turn-1",
							...(queued ? { queued: true } : {}),
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(livePhaseOf(messages, true)).toBe(expected);
	});
});

describe("latestTurnModeOf", () => {
	/** A stored reply: its summary part tells the mode of its turn. */
	function storedReply(id: string, mode: BuilderTurnMode): TurnMessage {
		return {
			id,
			role: "assistant",
			parts: [
				{
					type: "data-turn-summary",
					id: `summary-${id}`,
					data: { files: [], workedSeconds: 3, mode },
				},
			],
		};
	}
	const userMessage: TurnMessage = {
		id: "u1",
		role: "user",
		parts: [{ type: "text", text: "A shop" }],
	};

	// The Plan toggle and the planning note follow the newest turn: after
	// "Build this plan" they must show the build, not the plan before it.
	it.each<{ name: string; messages: TurnMessage[]; expected: BuilderTurnMode }>(
		[
			{
				name: "the created frame of the live turn over an older plan",
				messages: [
					storedReply("a1", "plan"),
					userMessage,
					{
						id: "a2",
						role: "assistant",
						parts: [
							{
								type: "data-turn-created",
								id: "turn-created",
								data: {
									chatId: "chat-1",
									runId: null,
									status: "queued",
									streamUrl: "/api/v2/projects/p/turns/active/stream",
									turnId: "turn-2",
									mode: "build",
								},
							},
						],
					},
				],
				expected: "build",
			},
			{
				name: "the stored summary while a new send waits for its frame",
				messages: [storedReply("a1", "plan"), userMessage],
				expected: "plan",
			},
			{
				name: "the reply before a stored reply with no summary",
				messages: [
					storedReply("a1", "plan"),
					userMessage,
					{ id: "a2", role: "assistant", parts: [{ type: "text", text: "…" }] },
				],
				expected: "plan",
			},
			{
				name: "build when no reply tells",
				messages: [userMessage],
				expected: "build",
			},
		],
	)("returns $expected: $name", ({ messages, expected }) => {
		expect(latestTurnModeOf(messages)).toBe(expected);
	});
});

describe("toBuilderMessages", () => {
	it("keeps the text and file parts of a user message", () => {
		const messages = [
			{
				id: "u1",
				role: "user",
				parts: [
					{ type: "text", text: "Add this logo" },
					{
						type: "file",
						mediaType: "image/png",
						url: "data:image/png;base64,xx",
						filename: "logo.png",
					},
				],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(messages, IDLE);
		expect(out).toHaveLength(1);
		expect(out[0].parts.map((part) => part.type)).toEqual(["text", "file"]);
	});

	// The production chat shows only the final `text`; a `data-note` goes to the details.
	it.each<{
		name: string;
		parts: TurnMessagePart[];
		options: { isRunning: boolean };
		/** Each output part as its type and its text; null for a part without text. */
		expected: [string, string | null][];
	}>([
		{
			name: "a note before the last step and the final text after it",
			parts: [
				{ type: "text", text: "Now the styles." },
				doneCall("edit", { file_path: "src/a.css" }),
				{ type: "text", text: "Your page is live." },
				{
					type: "data-turn-summary",
					id: "summary-turn-1",
					data: {
						files: [{ path: "src/a.css", insertions: 3, deletions: 1 }],
						workedSeconds: 42,
						mode: "build",
					},
				},
			],
			options: IDLE,
			expected: [
				["data-note", "Now the styles."],
				["data-step", null],
				["text", "Your page is live."],
				["data-summary", null],
			],
		},
		{
			// A step can still follow any text of a running turn.
			name: "only notes while the turn runs",
			parts: [
				{ type: "text", text: "Now the styles." },
				doneCall("edit", { file_path: "src/a.css" }),
				{ type: "text", text: "Your page is live." },
			],
			options: RUNNING,
			expected: [
				["data-note", "Now the styles."],
				["data-step", null],
				["data-note", "Your page is live."],
			],
		},
		{
			name: "all text as final in a reply with no step",
			parts: [
				{ type: "text", text: "Hello." },
				{ type: "text", text: "What do you want to build?" },
			],
			options: IDLE,
			expected: [
				["text", "Hello."],
				["text", "What do you want to build?"],
			],
		},
		{
			name: "no note for whitespace before a step",
			parts: [
				{ type: "text", text: "\n\n" },
				doneCall("edit", { file_path: "src/a.css" }),
				{ type: "text", text: "Done." },
			],
			options: IDLE,
			expected: [
				["data-step", null],
				["text", "Done."],
			],
		},
		{
			// ask_user gets no row, so it must not turn the question text into a note.
			name: "the final text before a hidden tool",
			parts: [
				doneCall("edit", { file_path: "src/a.css" }),
				{ type: "text", text: "Which style do you like?" },
				doneCall("ask_user", {}),
			],
			options: IDLE,
			expected: [
				["data-step", null],
				["text", "Which style do you like?"],
			],
		},
	])("splits the text of a reply: $name", ({ parts, options, expected }) => {
		const messages = [
			{ id: "a1", role: "assistant", parts },
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, options)[0].parts.map((part) => {
				if (part.type === "text") return [part.type, part.text];
				if (part.type === "data-note") return [part.type, part.data.text];
				return [part.type, null];
			}),
		).toEqual(expected);
	});

	it("reads the thought seconds of the reasoning block by its id", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "One.", state: "done" },
					{ type: "reasoning", id: "r-2", text: "Two.", state: "done" },
					{ type: "data-thought", data: { reasoningId: "r-2", seconds: 22 } },
					{ type: "data-thought", data: { reasoningId: "r-1", seconds: 5 } },
				],
			},
		] satisfies TurnMessage[];
		const thoughts = toBuilderMessages(messages, IDLE)[0].parts.flatMap(
			(part) => (part.type === "data-thought" ? [part.data] : []),
		);
		expect(thoughts).toEqual([
			{ text: "One.", seconds: 5, isStreaming: false },
			{ text: "Two.", seconds: 22, isStreaming: false },
		]);
	});

	it("streams the thought of the live reply only", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "Hmm", state: "streaming" },
				],
			},
		] satisfies TurnMessage[];
		const live = toBuilderMessages(messages, RUNNING)[0].parts[0];
		const stopped = toBuilderMessages(messages, IDLE)[0].parts[0];
		expect(live).toMatchObject({ data: { isStreaming: true } });
		// A stopped turn leaves the block in "streaming"; it must not shimmer forever.
		expect(stopped).toMatchObject({
			data: { isStreaming: false, seconds: null },
		});
	});

	it("drops an empty reasoning block with no timing", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{ type: "reasoning", id: "r-1", text: "", state: "done" },
					{ type: "text", text: "Done." },
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE)[0].parts.map((part) => part.type),
		).toEqual(["text"]);
	});

	it("merges a run of reads and searches into one explore row", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					doneCall("read", { file_path: "src/a.ts" }),
					{ type: "step-start" },
					doneCall("TodoWrite", {}),
					doneCall("grep", { pattern: "useChat" }),
					doneCall("edit", { file_path: "src/a.ts" }),
					doneCall("read", { file_path: "src/b.ts" }),
				],
			},
		] satisfies TurnMessage[];
		const steps = stepsOf(messages);
		expect(steps.map((step) => [step.kind, step.target])).toEqual([
			["explore", null],
			["edit", "a.ts"],
			["explore", "b.ts"],
		]);
		expect(steps[0].detail.map((line) => line.text)).toEqual([
			"src/a.ts",
			"useChat",
		]);
	});

	// A merged row holds one image at most; a merge would lose the image.
	it("keeps a read that shows an image in its own row", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					doneCall("read", { file_path: "src/a.ts" }),
					doneCall("read", { file_path: "public/hero.png" }, PNG_READ_OUTPUT),
					doneCall("read", { file_path: "src/b.ts" }),
				],
			},
		] satisfies TurnMessage[];
		expect(
			stepsOf(messages).map((step) => [step.target, step.imageUrl]),
		).toEqual([
			["a.ts", null],
			["hero.png", "data:image/png;base64,iVBORw0KGgo="],
			["b.ts", null],
		]);
	});

	it("runs a merged explore row while one of its reads runs", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					doneCall("read", { file_path: "src/a.ts" }),
					{
						type: "dynamic-tool",
						toolName: "glob",
						toolCallId: "call-2",
						state: "input-available",
						input: { pattern: "**/*.tsx" },
					},
				],
			},
		] satisfies TurnMessage[];
		expect(stepsOf(messages, RUNNING)[0].state).toBe("running");
	});

	it("opens the question of the last reply and closes it once a reply follows", () => {
		const question = {
			type: "data-question",
			id: "call-1:question-0",
			data: {
				toolCallId: "call-1",
				questionId: "question-0",
				question: "Which style?",
				kind: "single-choice",
				options: [{ id: "a", label: "Warm" }],
				answer: null,
			},
		} satisfies TurnMessagePart;
		const open = [
			{ id: "a1", role: "assistant", parts: [question] },
		] satisfies TurnMessage[];
		const answered = [
			...open,
			{ id: "u1", role: "user", parts: [{ type: "text", text: "Warm" }] },
			{ id: "a2", role: "assistant", parts: [{ type: "text", text: "Ok." }] },
		] satisfies TurnMessage[];
		const isQuestion = (
			part: BuilderMessagePart,
		): part is Extract<BuilderMessagePart, { type: "data-question" }> =>
			part.type === "data-question";
		expect(
			toBuilderMessages(open, IDLE)[0].parts.find(isQuestion)?.data,
		).toMatchObject({
			isOpen: true,
			isAnswered: false,
			kind: "single-choice",
			helper: null,
			maxFiles: null,
			options: [{ id: "a", label: "Warm" }],
		});
		expect(
			toBuilderMessages(answered, IDLE)[0].parts.find(isQuestion)?.data,
		).toMatchObject({ isOpen: false, isAnswered: true });
		// The paused turn still settles: the question is neither in the tray nor answered.
		expect(
			toBuilderMessages(open, RUNNING)[0].parts.find(isQuestion)?.data,
		).toMatchObject({ isOpen: false, isAnswered: false });
	});

	it("keeps a question open after a rejected answer, since no reply follows", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-question",
						id: "call-1:question-0",
						data: {
							toolCallId: "call-1",
							questionId: "question-0",
							question: "Which style?",
							kind: "free-text",
							options: [],
							answer: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "Warm" }] },
		] satisfies TurnMessage[];
		const question = toBuilderMessages(messages, IDLE)[0].parts[0];
		expect(question).toMatchObject({
			data: { isOpen: true, isAnswered: false },
		});
		// While the answer turn runs, the tray must not show the question again.
		expect(toBuilderMessages(messages, RUNNING)[0].parts[0]).toMatchObject({
			data: { isOpen: false },
		});
	});

	// A rejected answer gets no reply, so the card stays open for a new decision.
	// The answer itself is an empty user message, and it never shows.
	it.each([
		{ hasReply: true, ids: ["a1", "a2"], isOpen: false },
		{ hasReply: false, ids: ["a1"], isOpen: true },
	])("sets isOpen $isOpen on an approval card when a reply follows is $hasReply", ({
		hasReply,
		ids,
		isOpen,
	}) => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-approval",
						id: "ap-1",
						data: {
							approvalId: "ap-1",
							toolCallId: "call-9",
							toolName: "run_sql_write",
							input: "{}",
							decision: null,
						},
					},
				],
			},
			{ id: "u1", role: "user", parts: [{ type: "text", text: "" }] },
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", text: "Ran it." }],
			},
		] satisfies TurnMessage[];
		const out = toBuilderMessages(
			hasReply ? messages : messages.slice(0, 2),
			IDLE,
		);
		expect(out.map((message) => message.id)).toEqual(ids);
		expect(out[0].parts[0]).toMatchObject({ data: { isOpen } });
	});

	it("ends with the error and the receipt and never renders the status", () => {
		const messages = [
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-turn-status",
						id: "turn-status",
						data: { phase: "sandbox_waking" },
					},
					{ type: "text", text: "Working on it." },
					{
						type: "data-turn-error",
						id: "turn-error",
						data: { code: "X", message: "failed", retryable: false },
					},
					{
						type: "data-turn-usage",
						id: "turn-usage",
						data: {
							inputTokens: 10,
							outputTokens: 5,
							cacheReadTokens: 0,
							cacheWriteTokens: 0,
							credits: 42,
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE)[0].parts.map((part) => part.type),
		).toEqual(["text", "data-error", "data-receipt"]);
	});

	it("drops a reply that holds only the created frame, as after a cancel", () => {
		const messages = [
			{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "data-turn-created",
						id: "turn-created",
						data: {
							turnId: "9b1d6b24-3f0c-4c6f-9f1d-2f0d2a5a1c01",
							chatId: "9b1d6b24-3f0c-4c6f-9f1d-2f0d2a5a1c02",
							runId: null,
							status: "running",
							streamUrl: "/api/v2/projects/p1/turns/active/stream",
						},
					},
				],
			},
		] satisfies TurnMessage[];
		expect(
			toBuilderMessages(messages, IDLE).map((message) => message.id),
		).toEqual(["u1"]);
	});
});

/** The reply of the running turn with these parts. */
function reply(parts: BuilderMessagePart[]): BuilderMessage {
	return { id: "a1", role: "assistant", parts };
}

/** A finished step row with these fields; the other fields are empty. */
function stepPart(
	fields: Partial<BuilderDataParts["step"]>,
): BuilderMessagePart {
	return {
		type: "data-step",
		data: {
			kind: "explore",
			state: "done",
			target: null,
			description: null,
			detail: [],
			area: null,
			imageUrl: null,
			...fields,
		},
	};
}

describe("liveStatusOf", () => {
	const thought: BuilderMessagePart = {
		type: "data-thought",
		data: { text: "Plan the pages", seconds: null, isStreaming: true },
	};
	const note: BuilderMessagePart = {
		type: "data-note",
		data: { text: "Now the texts." },
	};
	const styleEdit = stepPart({
		kind: "edit",
		target: "global.css",
		area: "styles",
	});
	// A checkpoint sends usage during the turn, so a receipt can sit last.
	const receipt: BuilderMessagePart = {
		type: "data-receipt",
		id: "a1-receipt",
		data: {
			credits: 1,
			modelId: null,
			inputTokens: 10,
			outputTokens: 5,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		},
	};

	it.each<{
		name: string;
		liveMessage: BuilderMessage | null;
		phase: TurnStreamPhase | null;
		isFirstTurn: boolean;
		expected: LiveStatus;
	}>([
		{
			name: "the setup on a first turn before the first phase",
			liveMessage: null,
			phase: null,
			isFirstTurn: true,
			expected: { kind: "setup" },
		},
		{
			name: "the setup while the first turn creates the sandbox",
			liveMessage: null,
			phase: "sandbox_waking",
			isFirstTurn: true,
			expected: { kind: "setup" },
		},
		{
			name: "the wake while a later turn wakes the sandbox",
			liveMessage: null,
			phase: "sandbox_waking",
			isFirstTurn: false,
			expected: { kind: "wake" },
		},
		{
			name: "Thinking on a warm turn before the reply starts",
			liveMessage: null,
			phase: "session_starting",
			isFirstTurn: false,
			expected: { kind: "thinking" },
		},
		{
			// The sandbox is ready once the agent runs, so the setup lines stop.
			name: "Thinking on a first turn that runs with no activity yet",
			liveMessage: reply([receipt]),
			phase: "running",
			isFirstTurn: true,
			expected: { kind: "thinking" },
		},
		{
			name: "Thinking when the latest activity is a thought",
			liveMessage: reply([styleEdit, thought]),
			phase: "running",
			isFirstTurn: false,
			expected: { kind: "thinking" },
		},
		{
			name: "Writing when the latest activity is a note",
			liveMessage: reply([thought, note]),
			phase: "running",
			isFirstTurn: false,
			expected: { kind: "writing" },
		},
		{
			name: "the latest step with its area, also behind a receipt",
			liveMessage: reply([note, styleEdit, receipt]),
			phase: "running",
			isFirstTurn: false,
			expected: { kind: "step", stepKind: "edit", area: "styles" },
		},
		{
			name: "Saving while the turn commits after its last step",
			liveMessage: reply([styleEdit]),
			phase: "committing",
			isFirstTurn: false,
			expected: { kind: "saving" },
		},
		{
			// An ask_user turn with no text and no reasoning has no activity at all.
			name: "Saving while a turn with no activity commits",
			liveMessage: null,
			phase: "committing",
			isFirstTurn: false,
			expected: { kind: "saving" },
		},
	])("shows $name", ({ liveMessage, expected, ...input }) => {
		expect(liveStatusOf(liveMessage, input)).toEqual(expected);
	});
});

describe("workedDurationOf", () => {
	it.each<[number, ReturnType<typeof workedDurationOf>]>([
		[59, { unit: "seconds", count: 59 }],
		[60, { unit: "minutes", count: 1 }],
		[89, { unit: "minutes", count: 1 }],
		[90, { unit: "minutes", count: 2 }],
	])("says %i s as %j", (workedSeconds, expected) => {
		expect(workedDurationOf(workedSeconds)).toEqual(expected);
	});
});
