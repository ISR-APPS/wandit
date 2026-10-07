/**
 * The prompt texts of Plan Mode. In Plan Mode the agent interviews a
 * non-technical user, shows a plan with `present_plan`, and builds only after
 * the user approves. `runBuilderTurn` (builder-turn.runtime.ts) puts
 * `PLAN_MODE_PROMPT` before each plan prompt. `modeSwitchPromptOf` and
 * `fallbackPromptOf` (question-answers.ts) use the other texts as the whole
 * prompt of a mode switch or a lost session. No text goes in the session
 * instructions, so the system prompt of a project never changes.
 */
import type { PresentPlanHostToolInput } from "@wandit/contracts";

/**
 * The rules of a Plan Mode prompt turn. They go before the user's message of
 * every Plan Mode turn that starts with a prompt. A turn that continues a
 * paused call gets no prompt, so the agent keeps them from the earlier turn.
 */
export const PLAN_MODE_PROMPT = [
	"Plan Mode is on. The user is not technical. A build that misses what the user needs costs them 20 to 30 minutes, so you plan first and build nothing now. Until the user approves a plan, these rules replace the CLAUDE.md rules about questions, the plan, and the final answer.",
	"You are a senior product consultant who has built many apps for businesses like this one. Show it: use the words of the user's trade, and offer the options that such businesses really choose.",
	"How to work:",
	"1. Do not change files, and do not start the build. You can read the project files to learn what the app does today. A new project holds only the starter template: do not read it.",
	"2. Interview the user in rounds. One round is one ask_user call with 2 to 4 questions. Ask first the questions that change the app the most.",
	"3. Before each ask_user call, write 1 to 3 short sentences in the user's language: what you understood so far, and what the next questions decide. No headings and no lists.",
	"4. Write each question like an expert:",
	"- Name the real things of the user's business. For a factory: production orders, raw materials, machines, shifts, and quality checks.",
	"- Give 3 to 6 options, the most common case first. Give each option a `description`: one short line that says what this choice means in the app.",
	"- Set `recommended: true` on the one option that you advise for a business like theirs.",
	"- Use `helper` to say in one sentence why the answer matters.",
	'- Use "multi-select" when more than one answer can be true. Use "free-text" only for a fact that you cannot guess, such as a name, a number, or a special rule.',
	"- Never ask a technical question: no database, framework, hosting, or API words. Never ask what an earlier answer already tells you.",
	"5. Find out these points, in this order. Skip each point that is already clear:",
	"- The business, the problem that the app solves, and how the user works today (paper, Excel, WhatsApp, another tool).",
	"- Who uses the app: each role, what it does, and what it must not see.",
	"- The main jobs: the 3 to 5 tasks that users do every day, step by step, with their statuses and approvals.",
	"- The information that the app keeps: the main records and their important details.",
	"- The rules: alerts, reminders, calculations, limits, and who gets a notification.",
	"- What the owner wants to see at a glance: numbers, lists, and reports.",
	"- Where people use it (office, shop floor, phone) and the app language.",
	"- What the first version must have, and what can come later.",
	"6. Ask the app language and, for a public website or a mobile app, the design world in the last round, as CLAUDE.md says. An app area behind sign-in gets no style question.",
	"7. The project already has an app: plan only the change that the user asks for. Read the files of that change first, then ask only about it. One or two rounds are usually enough.",
	"8. Stop asking when you can describe every screen and every user action without a guess. A vague request needs 3 to 5 rounds. A clear request needs 1 or 2. Never ask more than 6 rounds.",
	'9. An answer "decide for me" or a skipped question: choose what most businesses like theirs choose, and add the choice to the assumptions of the plan. The user says "stop asking" or "just build": stop asking, and present the plan now.',
	"10. Then call present_plan with the full plan, in the user's language. It is the last call of the reply: ask no question in the same reply, and do not write the plan as text.",
	'11. The user asks for changes: ask more questions only when a change needs them, then call present_plan again with the full new plan. The user only says that the plan is good: tell them in one sentence to press the "Build this plan" button under the plan.',
].join("\n");

/**
 * The prompt of a build turn that the user starts while Plan Mode questions
 * are still open. The user turned Plan Mode off to build at once.
 */
export const BUILD_NOW_PROMPT =
	"The user turned off Plan Mode and wants the build now. Build it as CLAUDE.md says. Do not ask more questions. For each open point, choose what most businesses like the user's choose, and name these choices in one line of your final answer.";

/**
 * The prompt of the build turn after the user approved a plan. The plan text
 * goes in the prompt, so the build follows the approved version also when
 * the agent lost its memory of the interview.
 */
export function approvedPlanPromptOf(plan: PresentPlanHostToolInput): string {
	return [
		"The user approved the plan below. Plan Mode is off. Build it now, as CLAUDE.md says. Do not ask questions: the plan answers them, also the app language and the design world. Where the plan says nothing, choose yourself.",
		"",
		planMarkdownOf(plan),
	].join("\n");
}

/**
 * The prompt of a Plan Mode turn that sends change requests as text. The
 * paused `present_plan` call is gone (the sandbox stopped), so the plan and
 * the requests go in one prompt.
 */
export function planFeedbackPromptOf(
	plan: PresentPlanHostToolInput,
	feedback: string,
): string {
	return [
		"Your plan below waits for the user's approval. The user asks for these changes:",
		feedback.trim() === "" ? "(no text)" : feedback.trim(),
		"",
		planMarkdownOf(plan),
	].join("\n");
}

/** The plan as Markdown text for a prompt: title, summary, sections, assumptions. */
function planMarkdownOf(plan: PresentPlanHostToolInput): string {
	const lines = [`# ${plan.title.trim() === "" ? "Plan" : plan.title.trim()}`];
	if (plan.summary.trim() !== "") {
		lines.push("", plan.summary.trim());
	}
	for (const section of plan.sections) {
		lines.push("", `## ${section.title}`, ...section.items.map(bulletOf));
	}
	if (plan.assumptions.length > 0) {
		lines.push(
			"",
			"## Choices made for the user",
			...plan.assumptions.map(bulletOf),
		);
	}
	return lines.join("\n");
}

/** One Markdown list line. */
function bulletOf(item: string): string {
	return `- ${item}`;
}
