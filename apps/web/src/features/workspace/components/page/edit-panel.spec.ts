import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	activeTab: "theme" as "data" | "theme",
	dataDraft: "",
	dataMounts: 0,
	dataUnmounts: 0,
	editor: {} as Record<string, unknown>,
	isMobile: false,
	setDataDraft: undefined as undefined | ((draft: string) => void),
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key.split(".").at(-1) ?? key,
	}),
}));

vi.mock("@wandit/ui/hooks/use-mobile", () => ({
	useIsMobile: () => mocks.isMobile,
}));

vi.mock("@wandit/ui/components/tabs", async () => {
	const { createElement } = await import("react");
	return {
		Tabs: ({ children }: { children?: ReactNode }) => children,
		TabsList: ({ children }: { children?: ReactNode }) => children,
		TabsTrigger: ({
			children,
			value,
		}: {
			children?: ReactNode;
			value: string;
		}) => createElement("button", { "data-tab-trigger": value }, children),
		TabsContent: ({
			children,
			value,
		}: {
			children?: ReactNode;
			value: string;
		}) =>
			value === mocks.activeTab
				? createElement("div", { "data-tab-content": value }, children)
				: null,
	};
});

vi.mock("../../api/pages.queries", () => ({
	useVersionHtmlQuery: () => ({ data: { html: "<main>Preview</main>" } }),
}));

vi.mock("../../lib/preview-editor/parse-tokens", () => ({
	parsePageTheme: () => ({ tokens: {}, colorScheme: "light" as const }),
}));

vi.mock("../../lib/store", () => ({
	useWorkspace: () => ({ previewVersion: { id: "version-1" } }),
}));

vi.mock("../../lib/use-page-editor", () => ({
	usePageEditor: () => mocks.editor,
}));

vi.mock("./element-panel", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./element-panel")>();
	const { createElement } = await import("react");
	return {
		...actual,
		ElementPanel: () =>
			createElement("button", { "data-control": "element" }, "elementControl"),
	};
});

vi.mock("./theme-panel", async () => {
	const { createElement } = await import("react");
	return {
		ThemePanel: () =>
			createElement("button", { "data-control": "theme" }, "themeControl"),
	};
});

vi.mock("./data-panel", async () => {
	const { createElement, useEffect, useState } = await import("react");
	return {
		DataPanel: () => {
			const [draft, setDraft] = useState("");
			useEffect(() => {
				mocks.dataMounts += 1;
				return () => {
					mocks.dataUnmounts += 1;
				};
			}, []);
			mocks.dataDraft = draft;
			mocks.setDataDraft = setDraft;
			return createElement(
				"button",
				{ "data-control": "data", "data-draft": draft },
				"dataControl",
			);
		},
	};
});

import { EditPanel } from "./edit-panel";

function renderPanel(): string {
	return renderToStaticMarkup(createElement(EditPanel));
}

class FakeNode {
	readonly childNodes: FakeNode[] = [];
	parentNode: FakeNode | null = null;

	constructor(
		readonly nodeType: number,
		readonly nodeName: string,
		readonly ownerDocument: FakeDocument,
	) {}

	get firstChild() {
		return this.childNodes[0] ?? null;
	}

	appendChild(child: FakeNode) {
		child.parentNode = this;
		this.childNodes.push(child);
		return child;
	}

	insertBefore(child: FakeNode, before: FakeNode | null) {
		child.parentNode = this;
		const index = before ? this.childNodes.indexOf(before) : -1;
		if (index < 0) this.childNodes.push(child);
		else this.childNodes.splice(index, 0, child);
		return child;
	}

	removeChild(child: FakeNode) {
		const index = this.childNodes.indexOf(child);
		if (index >= 0) this.childNodes.splice(index, 1);
		child.parentNode = null;
		return child;
	}

	addEventListener() {}
	removeEventListener() {}
}

class FakeElement extends FakeNode {
	readonly attributes = new Map<string, string>();
	readonly namespaceURI = "http://www.w3.org/1999/xhtml";
	readonly style: Record<string, string> & {
		removeProperty: (name: string) => void;
		setProperty: (name: string, value: string) => void;
	};
	readonly tagName: string;

	constructor(tagName: string, ownerDocument: FakeDocument) {
		super(1, tagName.toUpperCase(), ownerDocument);
		this.tagName = tagName.toUpperCase();
		const style = {} as FakeElement["style"];
		style.setProperty = (name, value) => {
			style[name] = value;
		};
		style.removeProperty = (name) => {
			delete style[name];
		};
		this.style = style;
	}

	setAttribute(name: string, value: string) {
		this.attributes.set(name, String(value));
	}

	removeAttribute(name: string) {
		this.attributes.delete(name);
	}
}

class FakeText extends FakeNode {
	constructor(
		public nodeValue: string,
		ownerDocument: FakeDocument,
	) {
		super(3, "#text", ownerDocument);
	}
}

class FakeDocument extends FakeNode {
	activeElement: FakeElement | null = null;
	defaultView: Record<string, unknown> = {};

	constructor() {
		super(9, "#document", undefined as unknown as FakeDocument);
	}

	createElement(tagName: string) {
		return new FakeElement(tagName, this);
	}

	createElementNS(_namespace: string, tagName: string) {
		return this.createElement(tagName);
	}

	createTextNode(value: string) {
		return new FakeText(value, this);
	}
}

function installMinimalDom() {
	const document = new FakeDocument();
	const window = {
		document,
		HTMLElement: FakeElement,
		HTMLIFrameElement: class {},
		Node: FakeNode,
	};
	document.defaultView = window;
	vi.stubGlobal("document", document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("HTMLElement", FakeElement);
	vi.stubGlobal("Node", FakeNode);
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	return document.createElement("div");
}

describe("EditPanel AI working gate", () => {
	beforeEach(() => {
		mocks.activeTab = "theme";
		mocks.dataDraft = "";
		mocks.dataMounts = 0;
		mocks.dataUnmounts = 0;
		mocks.isMobile = false;
		mocks.setDataDraft = undefined;
		mocks.editor = {
			selection: null,
			isAskAiDispatching: false,
			dirtyCount: 0,
			isSaving: false,
			requestMode: vi.fn(),
			openDiscardPrompt: vi.fn(),
			save: vi.fn(),
		};
	});

	for (const scenario of [
		{
			name: "Element",
			selection: { wid: "hero-title" },
			tab: "theme" as const,
			normalControl: "elementControl",
		},
		{
			name: "Theme",
			selection: null,
			tab: "theme" as const,
			normalControl: "themeControl",
		},
		{
			name: "Data",
			selection: null,
			tab: "data" as const,
			normalControl: "dataControl",
		},
	]) {
		it(`shows one shared working state over the mounted ${scenario.name} surface, then restores it`, () => {
			mocks.activeTab = scenario.tab;
			mocks.editor.selection = scenario.selection;
			mocks.editor.isAskAiDispatching = true;

			const workingHtml = renderPanel();

			expect(workingHtml.match(/role="status"/g)).toHaveLength(1);
			expect(workingHtml).toContain('aria-live="polite"');
			expect(workingHtml).toContain("aiApplying");
			expect(workingHtml).toContain('data-slot="editor-working-state"');
			expect(workingHtml).toContain('data-slot="editor-panel-skeleton"');
			expect(workingHtml).toContain("animate-shimmer");
			expect(workingHtml).toContain("motion-reduce:animate-none");
			expect(workingHtml).toContain('aria-busy="true"');
			expect(workingHtml).toContain('hidden=""');
			expect(workingHtml).toContain('inert=""');
			expect(workingHtml).toContain(scenario.normalControl);
			expect(workingHtml).toContain("data-tab-trigger");

			mocks.editor.isAskAiDispatching = false;
			const restoredHtml = renderPanel();

			expect(restoredHtml).not.toContain("aiApplying");
			expect(restoredHtml).not.toContain('data-slot="editor-working-state"');
			expect(restoredHtml).not.toContain('data-slot="editor-panel-skeleton"');
			expect(restoredHtml).toContain('aria-busy="false"');
			expect(restoredHtml).not.toContain('hidden=""');
			expect(restoredHtml).not.toContain('inert=""');
			expect(restoredHtml).toContain(scenario.normalControl);
			expect(restoredHtml).toContain("data-tab-trigger");
		});
	}

	it("preserves an uncommitted Data draft through a dispatch cycle", async () => {
		mocks.activeTab = "data";
		const root = createRoot(installMinimalDom() as unknown as Element);

		await act(async () => {
			root.render(createElement(EditPanel));
		});
		expect(mocks.dataMounts).toBe(1);

		await act(async () => {
			mocks.setDataDraft?.("typed-but-unapplied@example.com");
		});
		expect(mocks.dataDraft).toBe("typed-but-unapplied@example.com");

		mocks.editor.isAskAiDispatching = true;
		await act(async () => {
			root.render(createElement(EditPanel));
		});
		expect(mocks.dataDraft).toBe("typed-but-unapplied@example.com");
		expect(mocks.dataMounts).toBe(1);
		expect(mocks.dataUnmounts).toBe(0);

		mocks.editor.isAskAiDispatching = false;
		await act(async () => {
			root.render(createElement(EditPanel));
		});
		expect(mocks.dataDraft).toBe("typed-but-unapplied@example.com");
		expect(mocks.dataMounts).toBe(1);

		await act(async () => root.unmount());
		vi.unstubAllGlobals();
	});

	it("hides mobile save controls for the dispatch duration", () => {
		mocks.isMobile = true;
		mocks.editor.dirtyCount = 2;
		mocks.editor.isAskAiDispatching = true;

		const workingHtml = renderPanel();
		expect(workingHtml).not.toContain(">discard</button>");
		expect(workingHtml).not.toContain(">save</button>");

		mocks.editor.isAskAiDispatching = false;
		const restoredHtml = renderPanel();
		expect(restoredHtml).toContain(">discard</button>");
		expect(restoredHtml).toContain(">save</button>");
	});
});
