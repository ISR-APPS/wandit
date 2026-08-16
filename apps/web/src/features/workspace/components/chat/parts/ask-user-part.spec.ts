import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AskUserGroupCard } from "./ask-user-part";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const value =
				(
					{
						"workspace.chat.askUser.answerBelow": "Answer below ↓",
						"workspace.chat.askUser.pickedForYou": "Wandit picked for you",
						"workspace.chat.askUser.questionsTitle": "A few questions",
						"workspace.chat.askUser.skipped": "Skipped",
						"workspace.chat.askUser.upNext": "Up next",
						"workspace.chat.tray.filesSent": "{count} file(s) sent",
					} as Record<string, string>
				)[key] ?? key;

			return value.replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
}));

type AskPart = ComponentProps<typeof AskUserGroupCard>["parts"][number];

const parts = [
	{
		type: "tool-ask_user",
		toolCallId: "ask-1",
		state: "output-available",
		input: { question: "Where is your audience?", options: [] },
		output: { text: "North Africa" },
	},
	{
		type: "tool-ask_user",
		toolCallId: "ask-2",
		state: "input-available",
		input: { question: "What is your budget?", options: [] },
	},
	{
		type: "tool-ask_user",
		toolCallId: "ask-3",
		state: "input-available",
		input: { question: "When should it launch?", options: [] },
	},
	{
		type: "tool-ask_user",
		toolCallId: "ask-4",
		state: "output-available",
		input: { question: "Which tone should we use?", options: [] },
		output: { delegated: true },
	},
] satisfies AskPart[];

describe("AskUserGroupCard", () => {
	it("starts collapsed: the summary row renders, the questions do not", () => {
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts,
				activeAskToolCallId: "ask-2",
				ownsActiveAsk: true,
				isAfterActiveAsk: false,
			}),
		);

		expect(html).toContain("A few questions");
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("Where is your audience?");
		expect(html).not.toContain("What is your budget?");
	});

	it("renders one Wandit header with answered, active, queued, and delegated statuses", () => {
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts,
				activeAskToolCallId: "ask-2",
				ownsActiveAsk: true,
				isAfterActiveAsk: false,
				defaultOpen: true,
			}),
		);

		expect(html.match(/>Wandit</g)).toHaveLength(1);
		expect(html).toContain("A few questions");
		expect(html).toContain("North Africa");
		expect(html).toContain("Answer below ↓");
		expect(html).toContain("Up next");
		expect(html).toContain("Wandit picked for you");
	});

	it("uses the same grouped card for a single question", () => {
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts: [parts[1] as AskPart],
				activeAskToolCallId: "ask-2",
				ownsActiveAsk: true,
				isAfterActiveAsk: false,
				defaultOpen: true,
			}),
		);

		expect(html.match(/>Wandit</g)).toHaveLength(1);
		expect(html).toContain("What is your budget?");
		expect(html).toContain("Answer below ↓");
	});

	it("marks only pending questions after the active row as up next", () => {
		const pendingParts = ["ask-before", "ask-active", "ask-after"].map(
			(toolCallId) =>
				({
					type: "tool-ask_user",
					toolCallId,
					state: "input-available",
					input: { question: toolCallId, options: [] },
				}) satisfies AskPart,
		);
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts: pendingParts,
				activeAskToolCallId: "ask-active",
				ownsActiveAsk: true,
				isAfterActiveAsk: false,
				defaultOpen: true,
			}),
		);

		expect(html.match(/Up next/g)).toHaveLength(1);
	});

	it("shows the answer value and attachment count in the same receipt", () => {
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts: [
					{
						type: "tool-ask_user",
						toolCallId: "ask-with-files",
						state: "output-available",
						input: { question: "What should we build?", options: [] },
						output: {
							text: "Build the product page",
							files: [
								{
									url: "https://example.com/product.png",
									mediaType: "image/png",
									filename: "product.png",
								},
							],
						},
					} satisfies AskPart,
				],
				ownsActiveAsk: false,
				isAfterActiveAsk: false,
				defaultOpen: true,
			}),
		);

		expect(html).toContain("Build the product page");
		expect(html).toContain("1 file(s) sent");
		expect(html).toMatch(
			/<p[^>]*>.*Build the product page.*1 file\(s\) sent.*<\/p>/,
		);
	});

	it("keeps a pure attachment answer as a file-count receipt", () => {
		const html = renderToStaticMarkup(
			createElement(AskUserGroupCard, {
				parts: [
					{
						type: "tool-ask_user",
						toolCallId: "ask-files-only",
						state: "output-available",
						input: { question: "Attach a reference", options: [] },
						output: {
							files: [
								{
									url: "https://example.com/reference.pdf",
									mediaType: "application/pdf",
									filename: "reference.pdf",
								},
							],
						},
					} satisfies AskPart,
				],
				ownsActiveAsk: false,
				isAfterActiveAsk: false,
				defaultOpen: true,
			}),
		);

		expect(html).toContain("1 file(s) sent");
	});
});
