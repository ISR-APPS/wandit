/**
 * Turns the user's answers to paused question and plan cards into what the
 * agent reads. builder-turn.runtime.ts calls it when a turn continues a
 * paused one: the `ask_user` and `present_plan` tool results, the built-in
 * `askUserQuestions` result, the text a fresh session or a mode switch gets
 * instead, and the sandbox path of an answer file. Pure functions, no I/O.
 */
import type {
	AskUserHostToolOutput,
	BuilderTurnMode,
	FileRef,
	HarnessPendingInteraction,
	HarnessResumeEnvelope,
	TurnQuestionAnswer,
} from "@wandit/contracts";

import {
	approvedPlanPromptOf,
	BUILD_NOW_PROMPT,
	planFeedbackPromptOf,
} from "./plan-mode";
import type { HarnessQuestionResult } from "./ports/builder-harness";

/** One paused question card, as the resume envelope stores it. */
export type QuestionInteraction = Extract<
	HarnessPendingInteraction,
	{ kind: "question" }
>;

/** One paused `present_plan` card, as the resume envelope stores it. */
type PlanInteraction = Extract<HarnessPendingInteraction, { kind: "plan" }>;

/** One answer of the `ask_user` tool result: one question of the call. */
type AskUserAnswer = AskUserHostToolOutput["answers"][number];

/** One answer file of the tool result, before the copy into the sandbox. */
type AnswerFile = AskUserAnswer["files"][number];

// The sanitized name the upload service writes as the last key segment
// (`sanitizeFilename`): no path parts, no leading dot.
const UPLOAD_FILENAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/;
// The uuid segment of an upload key; the copy name keeps its first 8 chars.
const UPLOAD_UUID_PATTERN = /^[0-9a-fA-F-]{8,}$/;

/**
 * The last path segment of a URL: the file name of a Wandit upload. Empty
 * when the URL has no path.
 */
function lastPathSegment(url: string): string {
	return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

/** A tool result file for one uploaded file; the copy fills `path` later. */
function answerFileOf(file: FileRef): AnswerFile {
	return {
		filename: file.filename ?? lastPathSegment(file.url),
		mediaType: file.mediaType,
		path: null,
		url: file.url,
	};
}

/**
 * The `ask_user` tool result of one paused call: one answer per question.
 * A `spec.answers` entry of the call wins. Without any entry for the call,
 * the message text answers the first question: an exact option label
 * picks that option, other text stays text. An empty message with
 * attachments sends the files. With nothing at all, the question counts
 * as skipped. Every other question of the call counts as skipped.
 */
export function askUserOutputOf(
	interaction: QuestionInteraction,
	answers: readonly TurnQuestionAnswer[],
	fallback: { message: string; attachments: readonly FileRef[] },
): AskUserHostToolOutput {
	const callAnswers = answers.filter(
		(answer) => answer.toolCallId === interaction.toolCallId,
	);
	return {
		answers: interaction.questions.map((question, index): AskUserAnswer => {
			const base = { question: question.question, questionId: question.id };
			const answer = callAnswers.find(
				(entry) => entry.questionId === question.id,
			);
			if (answer !== undefined) {
				const picked = question.options.filter((option) =>
					answer.optionIds.includes(option.id),
				);
				return {
					...base,
					action: answer.action,
					files: answer.files.map(answerFileOf),
					// A single choice keeps one option, even when the client sent more.
					selected: (question.kind === "single-choice"
						? picked.slice(0, 1)
						: picked
					).map((option) => ({ id: option.id, label: option.label })),
					text: answer.text,
				};
			}
			const message = fallback.message.trim();
			// The plain message answers only the first question of a call
			// that got no typed answers; the tray always sends typed ones.
			if (callAnswers.length > 0 || index > 0) {
				return {
					...base,
					action: "dismissed",
					files: [],
					selected: [],
					text: "",
				};
			}
			// An empty message matches no option: a blank label must not eat
			// the attachments.
			const option =
				message === ""
					? undefined
					: question.options.find(
							(candidate) =>
								candidate.label.trim().toLowerCase() === message.toLowerCase(),
						);
			if (option !== undefined) {
				return {
					...base,
					action: "answered",
					files: [],
					selected: [{ id: option.id, label: option.label }],
					text: "",
				};
			}
			if (message === "" && fallback.attachments.length === 0) {
				return {
					...base,
					action: "dismissed",
					files: [],
					selected: [],
					text: "",
				};
			}
			return {
				...base,
				action: "answered",
				files: fallback.attachments.map(answerFileOf),
				selected: [],
				text: message,
			};
		}),
	};
}

/** The answered form of one built-in `askUserQuestions` call. */
type BuiltinQuestionResult = Extract<
	HarnessQuestionResult,
	{ tool: "askUserQuestions" }
>;

/**
 * The result of one paused built-in `askUserQuestions` call, from a chat
 * that paused before `ask_user` existed. The typed answers of the call win:
 * one record entry per answered question. Without them, the message text
 * answers the first question. Null when the call holds no question.
 */
export function builtinQuestionResultOf(
	interaction: QuestionInteraction,
	answers: readonly TurnQuestionAnswer[],
	messageText: string,
): BuiltinQuestionResult | null {
	const callAnswers = answers.filter(
		(answer) => answer.toolCallId === interaction.toolCallId,
	);
	if (callAnswers.length === 0) {
		const question = interaction.questions[0];
		if (question === undefined) {
			return null;
		}
		const option = question.options.find(
			(candidate) =>
				candidate.label.trim().toLowerCase() === messageText.toLowerCase(),
		);
		return {
			answers: {
				[question.id]:
					option === undefined
						? { freeform: messageText, optionIds: [] }
						: { optionIds: [option.id] },
			},
			// A plain message answers one question; the harness asks the rest again.
			partial: interaction.questions.length > 1,
			tool: "askUserQuestions",
			toolCallId: interaction.toolCallId,
		};
	}
	const record: BuiltinQuestionResult["answers"] = {};
	for (const question of interaction.questions) {
		const entry = callAnswers.find(
			(answer) => answer.questionId === question.id,
		);
		if (entry === undefined) {
			continue;
		}
		// Cards stored before the option ids existed show the label as the
		// id, so the tray can send a label back.
		const optionIds = question.options
			.filter(
				(option) =>
					entry.optionIds.includes(option.id) ||
					entry.optionIds.includes(option.label),
			)
			.map((option) => option.id);
		const freeform =
			entry.action === "delegated"
				? "The user lets you decide."
				: entry.text.trim() === ""
					? undefined
					: entry.text;
		// A skipped question with no text says nothing; the harness asks it again.
		if (entry.action === "dismissed" && freeform === undefined) {
			continue;
		}
		record[question.id] =
			freeform === undefined ? { optionIds } : { freeform, optionIds };
	}
	return {
		answers: record,
		partial: Object.keys(record).length < interaction.questions.length,
		tool: "askUserQuestions",
		toolCallId: interaction.toolCallId,
	};
}

/** One readable line for one answer; a fresh session reads it as text. */
function answerLineOf(answer: AskUserAnswer): string {
	if (answer.action === "delegated") {
		return `Answer to your question "${answer.question}": the user lets you decide.`;
	}
	if (answer.action === "dismissed") {
		return answer.text === ""
			? `Answer to your question "${answer.question}": skipped.`
			: `Answer to your question "${answer.question}": skipped, then wrote: ${answer.text}`;
	}
	const parts = [
		answer.selected.map((option) => option.label).join(", "),
		answer.text,
		answer.files.map((file) => file.path ?? file.url).join(", "),
	].filter((part) => part !== "");
	return `Answer to your question "${answer.question}": ${parts.join("; ")}`;
}

/**
 * The text a fresh session gets when the paused session is lost: one line
 * per answered question and per approval, and the plan with the change
 * requests, in card order. `messageText` is the answer of a built-in
 * `askUserQuestions` card.
 */
export function fallbackPromptOf(input: {
	pending: readonly HarnessPendingInteraction[];
	results: readonly HarnessQuestionResult[];
	approvals: readonly { approvalId: string; approved: boolean }[];
	messageText: string;
}): string {
	return input.pending
		.flatMap((interaction): string[] => {
			if (interaction.kind === "approval") {
				const approved =
					input.approvals.find(
						(approval) => approval.approvalId === interaction.approvalId,
					)?.approved ?? false;
				return [
					`The user ${approved ? "approved" : "denied"} the ${interaction.toolName} call. Continue.`,
				];
			}
			if (interaction.kind === "plan") {
				const result = input.results.find(
					(candidate) => candidate.toolCallId === interaction.toolCallId,
				);
				return result?.tool === "present_plan"
					? [planFeedbackPromptOf(interaction.plan, result.output.feedback)]
					: [];
			}
			if (interaction.tool === "askUserQuestions") {
				const question = interaction.questions[0];
				return question === undefined
					? []
					: [
							`Answer to your question "${question.question}": ${input.messageText}`,
						];
			}
			const result = input.results.find(
				(candidate) => candidate.toolCallId === interaction.toolCallId,
			);
			return result?.tool === "ask_user"
				? result.output.answers.map(answerLineOf)
				: [];
		})
		.join("\n");
}

/**
 * True when the turn's mode differs from the mode of a paused turn with
 * cards. The harness fixes the tool list per session, so the paused call
 * cannot continue: the answers go as a text prompt instead.
 */
export function switchesMode(
	paused: Pick<HarnessResumeEnvelope, "mode" | "pending">,
	mode: BuilderTurnMode,
): boolean {
	return paused.pending.length > 0 && paused.mode !== mode;
}

/**
 * The text prompt of a turn that switches mode (see `switchesMode`). A build
 * after a plan card gets the approved plan. A build with open questions
 * gets the build-now rule and the answers. A plan turn gets the answers
 * only: the runtime puts `PLAN_MODE_PROMPT` in front of every plan prompt.
 */
export function modeSwitchPromptOf(input: {
	/** The pending cards of the stored resume envelope. */
	pending: readonly HarnessPendingInteraction[];
	/** `spec.mode` of this turn. */
	mode: BuilderTurnMode;
	/** The answers as text lines, from `fallbackPromptOf`. */
	answerLines: string;
	/** The user's prompt text; empty when the user typed and attached nothing. */
	message: string;
}): string {
	const message = input.message.trim();
	const messageLines = message === "" ? [] : [`The user's message: ${message}`];
	const planCard = input.pending.find(
		(interaction): interaction is PlanInteraction =>
			interaction.kind === "plan",
	);
	if (input.mode === "build" && planCard !== undefined) {
		return [approvedPlanPromptOf(planCard.plan), ...messageLines].join("\n\n");
	}
	return [
		...(input.mode === "build" ? [BUILD_NOW_PROMPT] : []),
		...(input.answerLines === "" ? [] : [input.answerLines]),
		...messageLines,
	].join("\n\n");
}

/**
 * The project-relative copy path of one Wandit upload URL, or null when the
 * URL does not end in `<uuid>/<sanitized file name>`. The uuid prefix keeps
 * two uploads with the same file name apart.
 */
export function uploadCopyPath(url: string): string | null {
	const segments = new URL(url).pathname.split("/").filter(Boolean);
	const filename = segments.at(-1);
	const uuid = segments.at(-2);
	// Security check: only the sanitized upload name reaches the sandbox
	// path, so a crafted URL cannot write outside public/uploads/.
	if (
		filename === undefined ||
		uuid === undefined ||
		!UPLOAD_FILENAME_PATTERN.test(filename) ||
		!UPLOAD_UUID_PATTERN.test(uuid)
	) {
		return null;
	}
	return `public/uploads/${uuid.slice(0, 8)}-${filename}`;
}
