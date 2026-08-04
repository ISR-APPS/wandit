import type {
	AiElementOp,
	ApplyElementOpsInput,
	ApplyElementOpsOutput,
	ReadElementsInput,
	ReadElementsOutput,
	ReadThemeInput,
	ReadThemeOutput,
} from "@wandit/contracts";
import type { Tool } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { PageEditsService } from "../../../pages/application/services/page-edits.service";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { createPageEditTools } from "./page-edit.tools";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getPageHtml: vi.fn(),
}));

const PROJECT_ID = "project_1";
const TOOL_CALL_OPTIONS = {
	messages: [],
	toolCallId: "call_1",
};

const PAGE_HTML = `<!doctype html><html><head>
	<style>:root {
		--background: #ffffff;
		--primary: #123456;
	}</style>
	<style>:root { --background: #000000; --accent: #ff0000; }</style>
</head><body>
	<section data-wid="hero">
		<h1 data-wid="e-1">A precise headline</h1>
		<a data-wid="e-2" href="https://example.com">Order now</a>
	</section>
</body></html>`;

function setup() {
	const pageEditsService = { applyAiOps: vi.fn() };
	const pagesRepository = { findActivePageByProjectUnchecked: vi.fn() };
	const tools = createPageEditTools({
		pageEditsService: pageEditsService as unknown as PageEditsService,
		pagesRepository: pagesRepository as unknown as PagesRepository,
		projectId: PROJECT_ID,
	});

	return { pageEditsService, pagesRepository, tools };
}

async function executeTool<I, O>(pageTool: Tool<I, O>, input: I): Promise<O> {
	const execute = pageTool.execute;

	if (!execute) {
		throw new Error("page tool must have execute");
	}

	return (await execute(
		input,
		TOOL_CALL_OPTIONS as unknown as Parameters<typeof execute>[1],
	)) as unknown as O;
}

function mockActivePage(
	pagesRepository: ReturnType<typeof setup>["pagesRepository"],
): void {
	pagesRepository.findActivePageByProjectUnchecked.mockResolvedValue({
		version: { number: 7, r2Key: "sites/project_1/version_7/index.html" },
	});
	vi.mocked(getPageHtml).mockResolvedValue(PAGE_HTML);
}

beforeEach(() => {
	vi.mocked(getPageHtml).mockReset();
});

describe("apply_element_ops tool", () => {
	const allowedOps: Array<{ kind: AiElementOp["kind"]; op: AiElementOp }> = [
		{
			kind: "text",
			op: { kind: "text", value: "A sharper headline", wid: "e-1" },
		},
		{
			kind: "element-style",
			op: {
				kind: "element-style",
				value: { fontSize: "48px" },
				wid: "e-1",
			},
		},
		{
			kind: "set-tokens",
			op: { kind: "set-tokens", value: { primary: "#224466" } },
		},
		{
			kind: "set-link-href",
			op: {
				kind: "set-link-href",
				value: "https://wandit.example/order",
				wid: "e-2",
			},
		},
		{
			kind: "remove-element",
			op: { kind: "remove-element", wid: "e-2" },
		},
		{
			kind: "section-style",
			op: {
				kind: "section-style",
				value: { backgroundColor: "#f4f0e8", paddingTop: "l" },
				wid: "hero",
			},
		},
	];

	it.each(
		allowedOps,
	)("applies one $kind op and reports the new version", async ({ op }) => {
		const { pageEditsService, tools } = setup();
		pageEditsService.applyAiOps.mockResolvedValue({
			status: "applied",
			versionNumber: 8,
		});

		const output = await executeTool<
			ApplyElementOpsInput,
			ApplyElementOpsOutput
		>(tools.apply_element_ops, { ops: [op] });

		expect(pageEditsService.applyAiOps).toHaveBeenCalledWith(PROJECT_ID, [op]);
		expect(output).toEqual({
			message: "Done — version 8 is live in the Page tab.",
			status: "applied",
			versionNumber: 8,
		});
	});

	it.each([
		'no element carries data-wid="missing"',
		'data-wid "e-2" is not unique',
	])("surfaces a rejected op reason: %s", async (message) => {
		const { pageEditsService, tools } = setup();
		pageEditsService.applyAiOps.mockResolvedValue({
			message,
			status: "rejected",
		});

		const output = await executeTool<
			ApplyElementOpsInput,
			ApplyElementOpsOutput
		>(tools.apply_element_ops, {
			ops: [{ kind: "text", value: "Updated", wid: "missing" }],
		});

		expect(output).toEqual({ message, status: "rejected" });
	});

	it("relays an indexed batch rejection diagnostic unchanged", async () => {
		const { pageEditsService, tools } = setup();
		const ops = allowedOps.slice(0, 2).map(({ op }) => op);
		const message =
			'op 2 (element-style, data-wid="e-1"): width is only supported for <img> elements';
		pageEditsService.applyAiOps.mockResolvedValue({
			message,
			status: "rejected",
		});

		const output = await executeTool<
			ApplyElementOpsInput,
			ApplyElementOpsOutput
		>(tools.apply_element_ops, { ops });

		expect(output).toEqual({ message, status: "rejected" });
	});

	it("forwards a batch atomically in one service call", async () => {
		const { pageEditsService, tools } = setup();
		const ops = allowedOps.slice(0, 2).map(({ op }) => op);
		pageEditsService.applyAiOps.mockResolvedValue({
			status: "applied",
			versionNumber: 8,
		});

		await executeTool<ApplyElementOpsInput, ApplyElementOpsOutput>(
			tools.apply_element_ops,
			{ ops },
		);

		expect(pageEditsService.applyAiOps).toHaveBeenCalledOnce();
		expect(pageEditsService.applyAiOps).toHaveBeenCalledWith(PROJECT_ID, ops);
	});
});

describe("read_elements tool", () => {
	it("returns found and not-found elements in request order", async () => {
		const { pagesRepository, tools } = setup();
		mockActivePage(pagesRepository);

		const output = await executeTool<ReadElementsInput, ReadElementsOutput>(
			tools.read_elements,
			{ wids: ["e-2", "missing", "e-1"] },
		);

		expect(output).toMatchObject({
			elements: [
				{
					found: true,
					html: expect.stringContaining('data-wid="e-2"'),
					wid: "e-2",
				},
				{ found: false, wid: "missing" },
				{
					found: true,
					html: expect.stringContaining("A precise headline"),
					wid: "e-1",
				},
			],
			status: "ok",
			versionNumber: 7,
		});
	});
});

describe("read_theme tool", () => {
	it("reads reserved values from the first root block and omits missing tokens", async () => {
		const { pagesRepository, tools } = setup();
		mockActivePage(pagesRepository);

		const output = await executeTool<ReadThemeInput, ReadThemeOutput>(
			tools.read_theme,
			{},
		);

		expect(output).toEqual({
			status: "ok",
			tokens: { background: "#ffffff", primary: "#123456" },
			versionNumber: 7,
		});
	});

	it("returns an empty token record when the page has no root block", async () => {
		const { pagesRepository, tools } = setup();
		mockActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body><section data-wid="hero"><p>Copy</p></section></body></html>',
		);

		const output = await executeTool<ReadThemeInput, ReadThemeOutput>(
			tools.read_theme,
			{},
		);

		expect(output).toEqual({
			status: "ok",
			tokens: {},
			versionNumber: 7,
		});
	});
});
