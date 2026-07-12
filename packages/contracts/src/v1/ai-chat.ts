import { z } from "zod";

/**
 * ask_user — the assistant asks ONE focused question, answered in the
 * composer tray. The user's answer comes back as the tool output.
 *
 * Backward compatibility matters here: old chats persisted parts with the
 * original narrow shapes ({question, 2-4 options} in / {selectedId, label}
 * out), and validateUIMessages re-runs these schemas on every history load.
 * So the schemas below only RELAX — nothing an old row relied on became
 * required or stricter.
 */
export const askUserOptionSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
});

// How the tray should render the question. Optional on input so old
// persisted rows (which predate the field) stay valid.
export const askUserKindSchema = z.enum([
	"single-choice",
	"multi-select",
	"free-text",
]);

export const askUserInputSchema = z.object({
	question: z.string().min(1),
	// Relaxed from .min(2): free-text asks carry no options. Schema default []
	// (NOT .min()) — hard lesson: min() on tool inputs kills runs when the
	// model asks an open question.
	options: z.array(askUserOptionSchema).max(6).default([]),
	// Optional so old persisted inputs stay valid; UI derives when absent:
	// 0 options → free-text, otherwise single-choice.
	kind: askUserKindSchema.optional(),
	// Quiet helper line rendered under the question.
	helper: z.string().optional(),
	// Legacy flag, kept so old rows still parse.
	allowFreeform: z.boolean().optional(),
});

// Old rows have {selectedId, label} — every field optional keeps them valid.
// Exactly one "answer shape" is set per response; the model reads whichever
// is present.
export const askUserOutputSchema = z.object({
	selectedId: z.string().min(1).optional(), // single-choice (legacy + new)
	label: z.string().min(1).optional(), // single-choice (legacy + new)
	selections: z.array(askUserOptionSchema).optional(), // multi-select picks
	text: z.string().optional(), // free-text answer (or typed-over answer)
	delegated: z.boolean().optional(), // "Decide for me" escape hatch
	dismissed: z.boolean().optional(), // tray X — treat as "skip, continue"
});

export type AskUserOption = z.infer<typeof askUserOptionSchema>;
export type AskUserKind = z.infer<typeof askUserKindSchema>;
export type AskUserInput = z.infer<typeof askUserInputSchema>;
export type AskUserOutput = z.infer<typeof askUserOutputSchema>;

/**
 * read_skill — the assistant loads a markdown playbook on demand (progressive
 * disclosure: the always-on system prompt stays small; deep domain knowledge
 * lives in skill files the model opens only when the task needs them).
 * The enum is the single source of truth for which skills exist.
 */
export const skillSlugSchema = z.enum(["landing-page-design"]);

export const readSkillInputSchema = z.object({
	skill: skillSlugSchema,
});

export const readSkillOutputSchema = z.object({
	skill: skillSlugSchema,
	markdown: z.string(),
});

export type SkillSlug = z.infer<typeof skillSlugSchema>;
export type ReadSkillInput = z.infer<typeof readSkillInputSchema>;
export type ReadSkillOutput = z.infer<typeof readSkillOutputSchema>;

/**
 * generate_page — the assistant queues a background page build. Deliberately
 * minimal: the brief is ONE free-text field, not a rigid structure, because
 * the brief itself is the tweak surface Zack iterates on. The tool answers
 * immediately (queued/unavailable); the finished page lands in the Page tab.
 */
export const generatePageInputSchema = z.object({
	// Short human title for the page (used for version labels).
	title: z.string().min(1).max(120),
	// The full creative brief the agent composed from the conversation:
	// product, audience, language(s), chosen aesthetic direction, sections,
	// offer/price, COD details. Free text on purpose.
	brief: z.string().min(50),
});

export const generatePageOutputSchema = z.object({
	// "unavailable" = server missing R2/Trigger credentials; the model relays
	// that honestly instead of pretending a page is coming.
	status: z.enum(["queued", "unavailable"]),
	attemptId: z.string().uuid().optional(),
	versionNumber: z.number().int().positive().optional(),
	// Human-facing note the model can relay verbatim.
	message: z.string(),
});

export type GeneratePageInput = z.infer<typeof generatePageInputSchema>;
export type GeneratePageOutput = z.infer<typeof generatePageOutputSchema>;

/** Tool map for typing UIMessage on both web and server without sharing runtime code. */
export type AiChatTools = {
	ask_user: { input: AskUserInput; output: AskUserOutput };
	read_skill: { input: ReadSkillInput; output: ReadSkillOutput };
	generate_page: { input: GeneratePageInput; output: GeneratePageOutput };
};

export const aiChatRoutes = {
	/** POST — AI SDK UI-message stream (useChat endpoint). */
	stream: (chatId: string) => `/api/v1/chats/${chatId}/ai-stream`,
} as const;
