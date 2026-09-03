// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const messages: Record<string, string> = {
	"workspace.chat.pageEdit.editing": "Editing the page",
	"workspace.chat.pageEdit.hideDetails": "Hide details",
	"workspace.chat.pageEdit.inspected": "Inspected the page",
	"workspace.chat.pageEdit.labels.applyElementOp": "Applying 1 edit",
	"workspace.chat.pageEdit.labels.applyElementOps": "Applying {count} edits",
	"workspace.chat.pageEdit.labels.getPageOutline": "Reading the page structure",
	"workspace.chat.pageEdit.labels.insertSection":
		"Adding a section {position} {wid}",
	"workspace.chat.pageEdit.labels.readElement": "Reading 1 element",
	"workspace.chat.pageEdit.labels.readElements": "Reading {count} elements",
	"workspace.chat.pageEdit.labels.readSection": "Reading section {wid}",
	"workspace.chat.pageEdit.labels.readTheme": "Reading the theme",
	"workspace.chat.pageEdit.labels.replaceSection": "Rewriting section {wid}",
	"workspace.chat.pageEdit.moreTargets": "+{count}",
	"workspace.chat.pageEdit.opKinds.elementStyle": "style",
	"workspace.chat.pageEdit.opKinds.imageSrc": "image",
	"workspace.chat.pageEdit.opKinds.insertElement": "new element",
	"workspace.chat.pageEdit.opKinds.removeElement": "removal",
	"workspace.chat.pageEdit.opKinds.sectionStyle": "section style",
	"workspace.chat.pageEdit.opKinds.setLinkHref": "link",
	"workspace.chat.pageEdit.opKinds.setPageTitle": "page title",
	"workspace.chat.pageEdit.opKinds.setTokens": "design tokens",
	"workspace.chat.pageEdit.opKinds.text": "text",
	"workspace.chat.pageEdit.positions.after": "after",
	"workspace.chat.pageEdit.positions.before": "before",
	"workspace.chat.pageEdit.receiptUpdated":
		"Page updated — v{n} · {count} edits",
	"workspace.chat.pageEdit.receiptUpdatedSingle":
		"Page updated — v{n} · 1 edit",
	"workspace.chat.pageEdit.showDetails": "Show details",
	"workspace.chat.pageEdit.states.applied": "Applied",
	"workspace.chat.pageEdit.states.failed": "Failed",
	"workspace.chat.pageEdit.states.noPage": "No page available",
	"workspace.chat.pageEdit.states.rejected": "Rejected",
	"workspace.chat.pageEdit.updated": "Page updated — version {n}",
};

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			(messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			),
	}),
}));

vi.mock("motion/react", () => ({
	motion: {
		div: ({
			animate: _animate,
			transition: _transition,
			...props
		}: Record<string, unknown>) => createElement("div", props),
	},
}));

import { PageEditActivityCard, type PageEditToolPart } from "./page-edit-part";

afterEach(cleanup);

function pagePart(value: unknown): PageEditToolPart {
	return value as PageEditToolPart;
}

function row(type: string): HTMLElement {
	const element = document.querySelector(`[data-page-edit-row="${type}"]`);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Missing page-edit row: ${type}`);
	}
	return element;
}

describe("PageEditActivityCard", () => {
	it("renders active, successful, and failed rows with mutation context", () => {
		render(
			createElement(PageEditActivityCard, {
				parts: [
					pagePart({
						input: {},
						output: { status: "ok", versionNumber: 4 },
						state: "output-available",
						toolCallId: "outline-1",
						type: "tool-get_page_outline",
					}),
					pagePart({
						errorText: "Theme inspection timed out.",
						input: {},
						state: "output-error",
						toolCallId: "theme-1",
						type: "tool-read_theme",
					}),
					pagePart({
						input: {
							ops: [
								{ kind: "text", wid: "hero" },
								{ kind: "element-style", wid: "order-form" },
								{ kind: "text", wid: "benefits" },
								{ kind: "text", wid: "footer" },
							],
						},
						state: "input-available",
						toolCallId: "ops-1",
						type: "tool-apply_element_ops",
					}),
				],
			}),
		);

		expect(screen.getByText("Editing the page")).toBeTruthy();
		expect(row("tool-get_page_outline").dataset.state).toBe("done");
		expect(row("tool-get_page_outline").dataset.secondary).toBe("true");
		expect(row("tool-read_theme").dataset.state).toBe("error");
		expect(row("tool-read_theme").dataset.secondary).toBe("true");
		expect(screen.getByText("Theme inspection timed out.")).toBeTruthy();
		expect(row("tool-apply_element_ops").dataset.state).toBe("active");
		expect(screen.getByText("Applying 4 edits")).toBeTruthy();
		expect(screen.getByText("hero, order-form, +2 · text, style")).toBeTruthy();
	});

	it("shows a rejected mutation as a warning with the output message", () => {
		render(
			createElement(PageEditActivityCard, {
				parts: [
					pagePart({
						input: { wid: "hero", html: "<section>replacement</section>" },
						output: {
							message: "The hero section changed before this edit applied.",
							status: "rejected",
						},
						state: "output-available",
						toolCallId: "replace-1",
						type: "tool-replace_section",
					}),
				],
			}),
		);

		expect(screen.queryByText("Rewriting section hero")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /Rejected/ }));

		expect(row("tool-replace_section").dataset.state).toBe("warning");
		expect(screen.getByText("Rewriting section hero")).toBeTruthy();
		expect(
			screen.getByText("The hero section changed before this edit applied."),
		).toBeTruthy();
	});

	it("collapses applied mutations into the highest-version receipt and expands", () => {
		render(
			createElement(PageEditActivityCard, {
				parts: [
					pagePart({
						input: { wid: "hero" },
						output: { status: "ok", wid: "hero" },
						state: "output-available",
						toolCallId: "read-1",
						type: "tool-read_section",
					}),
					pagePart({
						input: {
							ops: [
								{ kind: "text", wid: "hero" },
								{ kind: "image-src", wid: "hero-image" },
							],
						},
						output: {
							message: "Applied two edits.",
							status: "applied",
							versionNumber: 7,
						},
						state: "output-available",
						toolCallId: "ops-2",
						type: "tool-apply_element_ops",
					}),
					pagePart({
						input: {
							anchorWid: "order-form",
							html: "<section>guarantee</section>",
							position: "before",
						},
						output: {
							message: "Section inserted.",
							status: "applied",
							versionNumber: 9,
						},
						state: "output-available",
						toolCallId: "insert-1",
						type: "tool-insert_section",
					}),
				],
			}),
		);

		const receipt = screen.getByRole("button", {
			name: /Page updated — v9 · 3 edits/,
		});
		expect(receipt.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("Reading section hero")).toBeNull();

		fireEvent.click(receipt);

		expect(screen.getByText("Page updated — version 9")).toBeTruthy();
		expect(row("tool-read_section").dataset.secondary).toBe("true");
		expect(row("tool-apply_element_ops").dataset.state).toBe("done");
		expect(row("tool-insert_section").dataset.state).toBe("done");
		expect(screen.getByText("Adding a section before order-form")).toBeTruthy();
	});

	it("uses a subtle inspected receipt when the settled run only read the page", () => {
		render(
			createElement(PageEditActivityCard, {
				parts: [
					pagePart({
						input: { wids: ["hero", "order-form"] },
						output: { elements: [], status: "ok", versionNumber: 5 },
						state: "output-available",
						toolCallId: "elements-1",
						type: "tool-read_elements",
					}),
				],
			}),
		);

		const receipt = screen.getByRole("button", { name: /Inspected the page/ });
		expect(receipt.className).toContain("text-muted-foreground");
		expect(receipt.getAttribute("aria-expanded")).toBe("false");
	});
});
