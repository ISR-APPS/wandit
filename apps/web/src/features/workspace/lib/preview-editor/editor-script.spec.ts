import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

import { EDITOR_SCRIPT } from "./editor-script";
import { PREVIEW_MESSAGE_SOURCE, PREVIEW_PROTOCOL_VERSION } from "./messages";

type Listener = (event: Record<string, unknown>) => void;

class FakeElement {
	readonly attributes = new Map<string, string>();
	readonly children: FakeElement[] = [];
	readonly classNames = new Set<string>();
	readonly computedStyle: Record<string, string> = {};
	readonly style: Record<string, string> = {};
	readonly tagName: string;
	parentElement: FakeElement | null;
	childElementCount = 0;
	id = "";
	isConnected = true;
	removed = false;
	textContentAssignments = 0;
	private blurListener: (() => void) | null = null;
	private innerHtmlValue: string | null = null;
	private innerTextValue = "";
	private textContentOverride: string | null = null;

	constructor(
		tagName: string,
		wid?: string,
		parentElement: FakeElement | null = null,
	) {
		this.tagName = tagName.toUpperCase();
		this.parentElement = parentElement;
		if (parentElement) {
			parentElement.children.push(this);
			parentElement.childElementCount = parentElement.children.length;
		}
		if (wid) this.attributes.set("data-wid", wid);
	}

	readonly classList = {
		add: (name: string) => this.classNames.add(name),
		remove: (name: string) => this.classNames.delete(name),
	};

	get innerText() {
		return this.innerTextValue;
	}

	set innerText(value: string) {
		this.textContentOverride = null;
		this.innerTextValue = value;
		this.innerHtmlValue = value;
		for (const child of this.children) child.parentElement = null;
		this.children.length = 0;
		this.childElementCount = 0;
	}

	get textContent() {
		return this.textContentOverride ?? this.innerTextValue;
	}

	set textContent(value: string) {
		this.textContentAssignments += 1;
		this.textContentOverride = null;
		this.innerTextValue = value;
		this.innerHtmlValue = value;
		for (const child of this.children) child.parentElement = null;
		this.children.length = 0;
		this.childElementCount = 0;
	}

	get innerHTML() {
		if (this.children.length > 0) {
			return this.children.map((child) => child.serializeOuterHtml()).join("");
		}
		return this.innerHtmlValue ?? this.innerTextValue;
	}

	set innerHTML(value: string) {
		this.textContentOverride = null;
		this.innerHtmlValue = value;
		this.innerTextValue = value.replace(/<[^>]*>/g, "");
		for (const child of this.children) child.parentElement = null;
		this.children.length = 0;
		this.childElementCount = 0;
	}

	setEditedInnerText(value: string) {
		this.innerTextValue = value;
	}

	setFallbackTextContent(value: string) {
		this.textContentOverride = value;
	}

	private serializeOuterHtml(): string {
		const attributes = [...this.attributes]
			.map(([name, value]) => ` ${name}="${value}"`)
			.join("");
		return `<${this.tagName.toLowerCase()}${attributes}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
	}

	appendChild(child: FakeElement) {
		if (child.parentElement && child.parentElement !== this) {
			const siblings = child.parentElement.children;
			const index = siblings.indexOf(child);
			if (index >= 0) siblings.splice(index, 1);
			child.parentElement.childElementCount = siblings.length;
		}
		if (!this.children.includes(child)) this.children.push(child);
		this.innerHtmlValue = null;
		child.parentElement = this;
		child.isConnected = this.isConnected;
		this.childElementCount = this.children.length;
		return child;
	}

	closest(selector: string): FakeElement | null {
		let current: FakeElement | null = this;
		while (current) {
			if (selector === "svg" && current.tagName === "SVG") return current;
			if (selector === "form" && current.tagName === "FORM") return current;
			if (selector === "[data-wid]" && current.hasAttribute("data-wid")) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	hasAttribute(name: string) {
		return this.attributes.has(name);
	}

	getAttribute(name: string) {
		return this.attributes.get(name) ?? null;
	}

	setAttribute(name: string, value: string) {
		this.attributes.set(name, value);
		if (name === "style") {
			for (const key of Object.keys(this.style)) delete this.style[key];
			for (const declaration of value.split(";")) {
				const [rawName, ...rawValue] = declaration.split(":");
				if (!rawName || rawValue.length === 0) continue;
				const property = rawName
					.trim()
					.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
				this.style[property] = rawValue.join(":").trim();
			}
		}
	}

	removeAttribute(name: string) {
		this.attributes.delete(name);
		if (name === "style") {
			for (const key of Object.keys(this.style)) delete this.style[key];
		}
	}

	addEventListener(name: string, listener: () => void) {
		if (name === "blur") this.blurListener = listener;
	}

	removeEventListener(name: string, listener: () => void) {
		if (name === "blur" && this.blurListener === listener) {
			this.blurListener = null;
		}
	}

	focus() {}

	blur() {
		this.blurListener?.();
	}

	remove() {
		this.removed = true;
		this.isConnected = false;
		if (this.parentElement) {
			const siblings = this.parentElement.children;
			const index = siblings.indexOf(this);
			if (index >= 0) siblings.splice(index, 1);
			this.parentElement.childElementCount = siblings.length;
			this.parentElement = null;
		}
	}

	contains(target: unknown): boolean {
		return (
			target === this || this.children.some((child) => child.contains(target))
		);
	}

	querySelector(selector: string): FakeElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector: string): FakeElement[] {
		const selectors = selector.split(",").map((part) => part.trim());
		const matches = (element: FakeElement) =>
			selectors.some((candidate) => {
				if (candidate === "[data-wid]") {
					return element.hasAttribute("data-wid");
				}
				if (candidate === "img[data-wid]") {
					return element.tagName === "IMG" && element.hasAttribute("data-wid");
				}
				if (candidate === "img[data-wandit-brand-image]") {
					return (
						element.tagName === "IMG" &&
						element.hasAttribute("data-wandit-brand-image")
					);
				}
				if (candidate === "link[data-wandit-preview-font]") {
					return (
						element.tagName === "LINK" &&
						element.hasAttribute("data-wandit-preview-font")
					);
				}
				if (candidate === 'link[rel~="stylesheet"][href]') {
					return (
						element.tagName === "LINK" &&
						(element.getAttribute("rel") ?? "")
							.split(/\s+/)
							.includes("stylesheet") &&
						element.hasAttribute("href")
					);
				}
				return element.tagName === candidate.toUpperCase();
			});
		const descendants: FakeElement[] = [];
		const visit = (element: FakeElement) => {
			for (const child of element.children) {
				if (matches(child)) descendants.push(child);
				visit(child);
			}
		};
		visit(this);
		return descendants;
	}

	getBoundingClientRect() {
		return {
			left: 0,
			right: 100,
			top: 0,
			bottom: 100,
			width: 100,
			height: 100,
		};
	}
}

function createRuntime(options: { animationFrames?: boolean } = {}) {
	const parent = { postMessage: vi.fn() };
	const elements = new Map<string, FakeElement>();
	const documentListeners = new Map<
		string,
		{ listener: Listener; capture: boolean }[]
	>();
	const windowListeners = new Map<string, Listener>();
	const rootAttributes = new Map<string, string>();
	const rootStyle = { setProperty: vi.fn() };
	const animationFrameCallbacks = new Map<number, () => void>();
	let nextAnimationFrameId = 1;
	const body = new FakeElement("body");
	const head = new FakeElement("head");
	let hitStack: FakeElement[] = [];
	const findById = (root: FakeElement, id: string): FakeElement | null => {
		if (root.id === id) return root;
		for (const child of root.children) {
			const found = findById(child, id);
			if (found) return found;
		}
		return null;
	};

	const documentStub = {
		readyState: "complete",
		body,
		head,
		createElement: (tag: string) => new FakeElement(tag),
		documentElement: {
			style: rootStyle,
			setAttribute: (name: string, value: string) =>
				rootAttributes.set(name, value),
		},
		addEventListener: (name: string, listener: Listener, capture = false) => {
			const registered = documentListeners.get(name) ?? [];
			registered.push({ listener, capture });
			documentListeners.set(name, registered);
		},
		querySelector: (selector: string) => {
			const wid = /^\[data-wid="(.*)"\]$/.exec(selector)?.[1];
			return wid ? (elements.get(wid) ?? null) : null;
		},
		querySelectorAll: (selector: string) => [
			...head.querySelectorAll(selector),
			...body.querySelectorAll(selector),
		],
		elementsFromPoint: () => [...hitStack],
		getElementById: (id: string) => findById(head, id) ?? findById(body, id),
	};
	const defaultComputedStyle = {
		backgroundColor: "rgb(255, 255, 255)",
		backgroundImage: "none",
		borderRadius: "0px",
		color: "rgb(0, 0, 0)",
		direction: "ltr",
		fontFamily: "sans-serif",
		fontSize: "16px",
		fontStyle: "normal",
		fontWeight: "400",
		height: "100px",
		letterSpacing: "normal",
		lineHeight: "normal",
		objectFit: "fill",
		paddingBottom: "0px",
		paddingTop: "0px",
		textAlign: "start",
		width: "100px",
	};
	const windowStub = {
		parent,
		addEventListener: (name: string, listener: Listener) => {
			windowListeners.set(name, listener);
		},
		getComputedStyle: (element: FakeElement) => ({
			...defaultComputedStyle,
			...element.computedStyle,
		}),
		...(options.animationFrames
			? {
					requestAnimationFrame: (callback: () => void) => {
						const id = nextAnimationFrameId;
						nextAnimationFrameId += 1;
						animationFrameCallbacks.set(id, callback);
						return id;
					},
				}
			: {}),
	};

	runInNewContext(EDITOR_SCRIPT, {
		document: documentStub,
		URL,
		window: windowStub,
	});

	const emitParent = (
		type: string,
		payload: Record<string, unknown>,
		source: unknown = parent,
	) => {
		windowListeners.get("message")?.({
			source,
			data: {
				source: PREVIEW_MESSAGE_SOURCE,
				v: PREVIEW_PROTOCOL_VERSION,
				type,
				payload,
			},
		});
	};
	const dispatchDocument = (name: string, event: Record<string, unknown>) => {
		for (const { listener } of documentListeners.get(name) ?? [])
			listener(event);
	};

	return {
		body,
		dispatchDocument,
		documentListeners,
		elements,
		emitParent,
		head,
		setHitStack: (elementsAtPoint: FakeElement[]) => {
			hitStack = elementsAtPoint;
		},
		flushAnimationFrame: () => {
			const pending = [...animationFrameCallbacks];
			for (const [id, callback] of pending) {
				animationFrameCallbacks.delete(id);
				callback();
			}
		},
		pendingAnimationFrames: () => animationFrameCallbacks.size,
		parent,
		rootAttributes,
		rootStyle,
	};
}

function clickEvent(target: FakeElement, clientX = 0, clientY = 0) {
	return {
		target,
		clientX,
		clientY,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	};
}

describe("preview editor script", () => {
	it("applies the full style surface and placeholder only from the parent", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1");
		const input = new FakeElement("input", "e-2");
		const section = new FakeElement("section", "hero", new FakeElement("body"));
		runtime.elements.set("e-1", image);
		runtime.elements.set("e-2", input);
		runtime.elements.set("hero", section);

		const style = {
			backgroundColor: "#112233",
			borderRadius: "16px",
			color: "#fafafa",
			fontFamily: "Cairo, sans-serif",
			fontSize: "24px",
			fontStyle: "italic",
			fontWeight: "600",
			letterSpacing: "0.04em",
			lineHeight: "1.5",
			objectFit: "contain",
			textAlign: "end",
			width: "66%",
		};
		runtime.emitParent("apply-style", { wid: "e-1", style }, {});
		expect(image.style).toEqual({});

		runtime.emitParent("apply-style", { wid: "e-1", style });
		expect(image.style).toEqual(style);
		runtime.emitParent("set-placeholder", { wid: "e-2", value: "Phone" });
		expect(input.getAttribute("placeholder")).toBe("Phone");

		runtime.emitParent("remove-element", { wid: "hero" });
		expect(section.removed).toBe(false);
		runtime.emitParent("remove-element", { wid: "e-1" });
		expect(image.removed).toBe(true);
	});

	it("round-trips authored image sizing through a placeholder", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1");
		const paragraph = new FakeElement("p", "e-2");
		const srcset =
			"https://assets.example/old-small.jpg 480w, https://assets.example/old-large.jpg 1280w";
		image.setAttribute("width", "640");
		image.setAttribute("height", "480");
		image.setAttribute("srcset", srcset);
		image.setAttribute("sizes", "(max-width: 700px) 100vw, 50vw");
		image.setAttribute("style", "object-fit: cover; width: 75%");
		runtime.elements.set("e-1", image);
		runtime.elements.set("e-2", paragraph);

		runtime.emitParent("placeholder-image", {
			wid: "e-1",
			src: "data:image/svg+xml,placeholder",
			width: 800,
			height: 600,
		});

		expect(image.getAttribute("src")).toBe("data:image/svg+xml,placeholder");
		expect(image.getAttribute("srcset")).toBeNull();
		expect(image.getAttribute("sizes")).toBeNull();
		expect(image.getAttribute("alt")).toBe("");
		expect(image.getAttribute("data-wandit-placeholder")).toBe("1");
		expect(image.getAttribute("data-wandit-orig-snapshot")).toBe("1");
		expect(image.getAttribute("data-wandit-orig-width")).toBe("640");
		expect(image.getAttribute("data-wandit-orig-height")).toBe("480");
		expect(image.getAttribute("data-wandit-orig-srcset")).toBe(srcset);
		expect(image.getAttribute("width")).toBe("800");
		expect(image.getAttribute("height")).toBe("600");
		expect(image.style.aspectRatio).toBe("800 / 600");

		runtime.emitParent("placeholder-image", {
			wid: "e-2",
			src: "data:image/svg+xml,placeholder",
		});
		expect(paragraph.getAttribute("data-wandit-placeholder")).toBeNull();

		runtime.emitParent("swap-image", {
			wid: "e-1",
			src: "https://assets.example/new.jpg",
		});
		expect(image.getAttribute("data-wandit-placeholder")).toBeNull();
		expect(image.getAttribute("data-wandit-orig-snapshot")).toBeNull();
		expect(image.getAttribute("data-wandit-orig-srcset")).toBeNull();
		expect(image.getAttribute("width")).toBe("640");
		expect(image.getAttribute("height")).toBe("480");
		expect(image.getAttribute("srcset")).toBe(srcset);
		expect(image.getAttribute("sizes")).toBe("(max-width: 700px) 100vw, 50vw");
		expect(image.getAttribute("style")).toBe("object-fit: cover; width: 75%");
		expect(image.style).toMatchObject({ objectFit: "cover", width: "75%" });
		expect(image.getAttribute("src")).toBe("https://assets.example/new.jpg");
	});

	it("keeps non-aspect styles when restoring a legacy placeholder", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1");
		image.setAttribute("data-wandit-placeholder", "1");
		image.setAttribute("width", "800");
		image.setAttribute("height", "600");
		image.setAttribute("style", "object-fit: contain; aspect-ratio: 4 / 3");
		runtime.elements.set("e-1", image);

		runtime.emitParent("swap-image", {
			wid: "e-1",
			src: "https://assets.example/new.jpg",
		});

		expect(image.getAttribute("width")).toBeNull();
		expect(image.getAttribute("height")).toBeNull();
		expect(image.style.objectFit).toBe("contain");
		expect(image.style.aspectRatio).toBe("");
	});

	it("loads, deduplicates, and replaces allowlisted reset-preview font links", () => {
		const runtime = createRuntime();
		const firstHref =
			"https://fonts.googleapis.com/css2?family=Fraunces&display=swap";
		const secondHref =
			"https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap";

		runtime.emitParent("set-tokens", {
			values: { "font-heading": '"Fraunces", serif' },
			fontStylesheetHrefs: [firstHref, firstHref],
		});
		let links = runtime.head.querySelectorAll("link[data-wandit-preview-font]");
		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe(firstHref);
		expect(links[0]?.getAttribute("rel")).toBe("stylesheet");

		runtime.emitParent("set-tokens", {
			values: { "font-heading": '"Playfair Display", serif' },
			fontStylesheetHrefs: [secondHref],
		});
		links = runtime.head.querySelectorAll("link[data-wandit-preview-font]");
		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe(secondHref);

		runtime.rootStyle.setProperty.mockClear();
		runtime.emitParent("set-tokens", {
			values: { "font-heading": '"Unsafe", serif' },
			fontStylesheetHrefs: ["https://evil.example/font.css"],
		});
		expect(runtime.rootStyle.setProperty).not.toHaveBeenCalled();
		expect(
			runtime.head
				.querySelectorAll("link[data-wandit-preview-font]")[0]
				?.getAttribute("href"),
		).toBe(secondHref);

		runtime.rootStyle.setProperty.mockClear();
		runtime.emitParent("set-tokens", {
			values: { "font-heading": '"Malformed", serif' },
			fontStylesheetHrefs: [
				"https://fonts.googleapis.com/\ncss2?family=Unsafe",
			],
		});
		expect(runtime.rootStyle.setProperty).not.toHaveBeenCalled();
		expect(
			runtime.head
				.querySelectorAll("link[data-wandit-preview-font]")[0]
				?.getAttribute("href"),
		).toBe(secondHref);

		runtime.emitParent("set-tokens", {
			values: { "font-heading": '"System", sans-serif' },
			fontStylesheetHrefs: [],
		});
		expect(
			runtime.head.querySelectorAll("link[data-wandit-preview-font]"),
		).toHaveLength(0);
	});

	it("captures Escape and delegates the two-step decision to the parent", () => {
		const runtime = createRuntime();
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.parent.postMessage.mockClear();
		const preventDefault = vi.fn();
		const stopPropagation = vi.fn();
		const keydown = runtime.documentListeners.get("keydown")?.[0];

		expect(keydown?.capture).toBe(true);
		keydown?.listener({ key: "Escape", preventDefault, stopPropagation });
		expect(preventDefault).toHaveBeenCalledOnce();
		expect(stopPropagation).toHaveBeenCalledOnce();
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			{
				source: PREVIEW_MESSAGE_SOURCE,
				v: PREVIEW_PROTOCOL_VERSION,
				type: "escape",
				payload: {},
			},
			"*",
		);
	});

	it("mirrors the server's two-wrapper section and stamped-leaf predicate", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const wrapperOne = new FakeElement("div", undefined, body);
		const wrapperTwo = new FakeElement("main", undefined, wrapperOne);
		const section = new FakeElement("section", "hero", wrapperTwo);
		const wrapperThree = new FakeElement("div", undefined, wrapperTwo);
		const tooDeep = new FakeElement("section", "deep", wrapperThree);
		const label = new FakeElement("label", "e-3", body);
		const legend = new FakeElement("legend", "e-7", body);
		const span = new FakeElement("span", "e-4", body);
		const input = new FakeElement("input", "e-8", body);
		input.setAttribute("placeholder", "Email");
		const textarea = new FakeElement("textarea", "e-9", body);
		textarea.setAttribute("placeholder", "Message");
		const formattedSpan = new FakeElement("span", "e-10", body);
		new FakeElement("em", undefined, formattedSpan);
		const nonLeafSpan = new FakeElement("span", "e-5", body);
		new FakeElement("div", undefined, nonLeafSpan);
		const svg = new FakeElement("svg", undefined, body);
		const svgLabel = new FakeElement("label", "e-6", svg);

		runtime.emitParent("set-mode", { mode: "select" });
		for (const [target, expectedTag, expectedPlaceholder] of [
			[section, "section", null],
			[label, "label", null],
			[legend, "legend", null],
			[span, "span", null],
			[input, "input", "Email"],
			[textarea, "textarea", "Message"],
			[formattedSpan, "span", null],
		] as const) {
			runtime.parent.postMessage.mockClear();
			runtime.dispatchDocument("click", clickEvent(target));
			expect(runtime.parent.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "select",
					payload: expect.objectContaining({
						placeholder: expectedPlaceholder,
						tag: expectedTag,
					}),
				}),
				"*",
			);
		}

		for (const target of [tooDeep, nonLeafSpan, svgLabel]) {
			runtime.parent.postMessage.mockClear();
			runtime.dispatchDocument("click", clickEvent(target));
			expect(runtime.parent.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: "deselect" }),
				"*",
			);
		}
	});

	it("makes all-inline text editable even with stamped descendants", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const label = new FakeElement("label", "e-1", body);
		label.innerText = "Phone";
		new FakeElement("input", "e-2", label);
		const paragraph = new FakeElement("p", "e-3", body);
		paragraph.innerText = "By appointment";
		new FakeElement("em", undefined, paragraph);
		const nonInlineSpan = new FakeElement("span", "e-4", body);
		new FakeElement("div", undefined, nonInlineSpan);
		const heading = new FakeElement("h1", "e-5", body);
		heading.innerText = "Fast delivery";
		const accent = new FakeElement("span", "e-6", heading);
		new FakeElement("a", "e-7", accent);

		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(label));
		expect(label.getAttribute("contenteditable")).toBeNull();
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ textEditable: false }),
			}),
			"*",
		);

		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(paragraph));
		expect(paragraph.getAttribute("contenteditable")).toBe("true");
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ textEditable: true }),
			}),
			"*",
		);

		runtime.dispatchDocument("click", clickEvent(nonInlineSpan));
		expect(nonInlineSpan.getAttribute("contenteditable")).toBeNull();

		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(heading));
		expect(heading.getAttribute("contenteditable")).toBe("true");
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ textEditable: true }),
			}),
			"*",
		);
	});

	it("flattens inline formatting when an edited text target blurs", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const paragraph = new FakeElement("p", "e-1", body);
		paragraph.innerText = "By appointment";
		const accent = new FakeElement("span", "e-2", paragraph);
		new FakeElement("a", "e-3", accent);

		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.dispatchDocument("click", clickEvent(paragraph));
		runtime.parent.postMessage.mockClear();
		paragraph.setEditedInnerText("Seven days\na week");
		paragraph.blur();

		expect(paragraph.children).toHaveLength(0);
		expect(paragraph.textContentAssignments).toBe(1);
		expect(paragraph.getAttribute("contenteditable")).toBeNull();
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			{
				source: PREVIEW_MESSAGE_SOURCE,
				v: PREVIEW_PROTOCOL_VERSION,
				type: "text-edited",
				payload: {
					value: "Seven days\na week",
					wid: "e-1",
					flattenedWids: ["e-2", "e-3"],
				},
			},
			"*",
		);
	});

	it("never advances the ladder for caret clicks inside active edited text", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const surface = new FakeElement("article", "plate", section);
		surface.computedStyle.backgroundColor = "white";
		const paragraph = new FakeElement("p", "e-1", surface);
		runtime.setHitStack([paragraph, surface, section]);
		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.dispatchDocument("click", clickEvent(paragraph, 10, 10));
		runtime.parent.postMessage.mockClear();
		const caretClick = clickEvent(paragraph, 10, 10);

		runtime.dispatchDocument("click", caretClick);

		expect(caretClick.preventDefault).not.toHaveBeenCalled();
		expect(caretClick.stopPropagation).not.toHaveBeenCalled();
		expect(runtime.parent.postMessage).not.toHaveBeenCalled();
	});

	it("uses textContent for programmatic text flattening", () => {
		const runtime = createRuntime();
		const paragraph = new FakeElement("p", "e-1");
		new FakeElement("span", "e-2", paragraph);
		runtime.elements.set("e-1", paragraph);

		runtime.emitParent("set-text", {
			wid: "e-1",
			value: "First line\nSecond line",
		});

		expect(paragraph.textContent).toBe("First line\nSecond line");
		expect(paragraph.textContentAssignments).toBe(1);
		expect(paragraph.children).toHaveLength(0);
	});

	it("suspends inline editing and text/style mirrors without changing editor state", () => {
		const runtime = createRuntime();
		const paragraph = new FakeElement("p", "e-1", new FakeElement("body"));
		paragraph.innerText = "Original copy";
		let rectLeft = 0;
		paragraph.getBoundingClientRect = () => ({
			left: rectLeft,
			right: rectLeft + 100,
			top: 0,
			bottom: 100,
			width: 100,
			height: 100,
		});
		runtime.elements.set("e-1", paragraph);
		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.dispatchDocument("click", clickEvent(paragraph));
		const selectBox = runtime.body.children.find(
			(child) => child.id === "__wandit-select-box",
		);
		expect(paragraph.getAttribute("contenteditable")).toBe("true");
		expect(selectBox?.style.display).toBe("block");

		runtime.emitParent("set-suspended", { suspended: true });

		expect(paragraph.getAttribute("contenteditable")).toBeNull();
		expect(runtime.rootAttributes.get("data-wandit-mode")).toBe("edit");
		expect(selectBox?.style.display).toBe("block");

		runtime.emitParent("apply-style", {
			wid: "e-1",
			style: { color: "rgb(255, 0, 0)" },
		});
		runtime.emitParent("set-text", { wid: "e-1", value: "Blocked copy" });
		runtime.dispatchDocument("click", clickEvent(paragraph));
		expect(paragraph.style.color).toBeUndefined();
		expect(paragraph.textContent).toBe("Original copy");
		expect(paragraph.getAttribute("contenteditable")).toBeNull();

		runtime.parent.postMessage.mockClear();
		rectLeft = 24;
		runtime.emitParent("set-comment-pins", {
			pins: [{ wid: "e-1", number: 1 }],
		});
		runtime.emitParent("set-ai-targets", { wids: ["e-1"] });
		expect(
			runtime.body.children.some((child) =>
				child.classNames.has("__wandit-comment-pin"),
			),
		).toBe(true);
		expect(
			runtime.body.children.some((child) =>
				child.classNames.has("__wandit-ai-box"),
			),
		).toBe(true);
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "selection-rect",
				payload: expect.objectContaining({ left: 24, wid: "e-1" }),
			}),
			"*",
		);

		runtime.emitParent("set-suspended", { suspended: false });
		runtime.emitParent("apply-style", {
			wid: "e-1",
			style: { color: "rgb(0, 128, 0)" },
		});
		runtime.emitParent("set-text", { wid: "e-1", value: "Allowed copy" });
		runtime.dispatchDocument("click", clickEvent(paragraph, 30, 10));
		expect(paragraph.style.color).toBe("rgb(0, 128, 0)");
		expect(paragraph.textContent).toBe("Allowed copy");
		expect(paragraph.getAttribute("contenteditable")).toBe("true");
	});

	it("paints selection in a fixed overlay instead of target classes", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image));
		const selectBox = runtime.body.children.find(
			(child) => child.id === "__wandit-select-box",
		);

		expect(selectBox?.style).toMatchObject({
			display: "block",
			height: "108px",
			left: "-4px",
			top: "-4px",
			width: "108px",
		});
		expect(image.classNames).toEqual(new Set());
		expect(
			runtime.body.children
				.filter((child) => child.id.includes("wandit"))
				.every((child) => child.id.startsWith("__wandit-")),
		).toBe(true);
	});

	it("hides overlays for connected elements with no layout box", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));
		image.getBoundingClientRect = () => ({
			left: 0,
			right: 0,
			top: 0,
			bottom: 0,
			width: 0,
			height: 0,
		});

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image));
		const selectBox = runtime.body.children.find(
			(child) => child.id === "__wandit-select-box",
		);

		expect(image.isConnected).toBe(true);
		expect(selectBox?.style.display).toBe("none");
	});

	it("shows and hides the hover overlay without covering a selection", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("pointermove", {
			target: image,
			clientX: 10,
			clientY: 10,
		});
		const hoverBox = runtime.body.children.find(
			(child) => child.id === "__wandit-hover-box",
		);
		expect(hoverBox?.style).toMatchObject({
			display: "block",
			height: "108px",
			left: "-4px",
			top: "-4px",
			width: "108px",
		});

		runtime.dispatchDocument("pointerout", { target: image });
		expect(hoverBox?.style.display).toBe("none");

		runtime.dispatchDocument("click", clickEvent(image));
		runtime.dispatchDocument("pointermove", {
			target: image,
			clientX: 10,
			clientY: 10,
		});
		expect(hoverBox?.style.display).toBe("none");
	});

	it("hides hover previews while the pointer is over the active inline editor", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const surface = new FakeElement("article", "copy-card", section);
		surface.computedStyle.backgroundColor = "white";
		const paragraph = new FakeElement("p", "hero-copy", surface);
		paragraph.innerText = "Editable copy";
		paragraph.getBoundingClientRect = () => ({
			left: 0,
			right: 40,
			top: 0,
			bottom: 40,
			width: 40,
			height: 40,
		});
		runtime.setHitStack([paragraph, surface, section]);
		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.dispatchDocument("pointermove", {
			target: paragraph,
			clientX: 10,
			clientY: 10,
		});
		const hoverBox = runtime.body.children.find(
			(child) => child.id === "__wandit-hover-box",
		);
		expect(hoverBox?.style.display).toBe("block");

		runtime.dispatchDocument("click", clickEvent(paragraph, 10, 10));

		expect(paragraph.getAttribute("contenteditable")).toBe("true");
		expect(hoverBox?.style.display).toBe("none");

		runtime.dispatchDocument("pointermove", {
			target: paragraph,
			clientX: 10,
			clientY: 10,
		});
		expect(hoverBox?.style.display).toBe("none");
	});

	it("hides the selection overlay when cleared or browsing", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image));
		const selectBox = runtime.body.children.find(
			(child) => child.id === "__wandit-select-box",
		);
		runtime.emitParent("clear-selection", {});
		expect(selectBox?.style.display).toBe("none");

		runtime.dispatchDocument("click", clickEvent(image));
		expect(selectBox?.style.display).toBe("block");
		runtime.emitParent("set-mode", { mode: "browse" });
		expect(selectBox?.style.display).toBe("none");
	});

	it("hides the selection overlay when the selected element is removed", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));
		runtime.elements.set("e-1", image);

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image));
		const selectBox = runtime.body.children.find(
			(child) => child.id === "__wandit-select-box",
		);
		runtime.emitParent("remove-element", { wid: "e-1" });

		expect(image.isConnected).toBe(false);
		expect(selectBox?.style.display).toBe("none");
	});

	it("marks form fields and a form's only submit control as non-removable", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const form = new FakeElement("form", undefined, body);
		const input = new FakeElement("input", "e-1", form);
		const textarea = new FakeElement("textarea", "e-2", form);
		const submit = new FakeElement("button", "e-3", form);
		const cancel = new FakeElement("button", "e-4", form);
		cancel.setAttribute("type", "button");
		for (const element of [input, textarea, submit, cancel]) {
			runtime.elements.set(element.getAttribute("data-wid") ?? "", element);
		}

		runtime.emitParent("set-mode", { mode: "select" });
		for (const target of [input, textarea, submit]) {
			runtime.parent.postMessage.mockClear();
			runtime.dispatchDocument("click", clickEvent(target));
			expect(runtime.parent.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "select",
					payload: expect.objectContaining({ removable: false }),
				}),
				"*",
			);
		}

		runtime.emitParent("remove-element", { wid: "e-1" });
		runtime.emitParent("remove-element", { wid: "e-3" });
		expect(input.removed).toBe(false);
		expect(submit.removed).toBe(false);

		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(cancel));
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ removable: true }),
			}),
			"*",
		);

		const secondSubmit = new FakeElement("button", "e-5", form);
		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(submit));
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ removable: true }),
			}),
			"*",
		);
		expect(secondSubmit.getAttribute("type")).toBeNull();
	});

	it("reports an image's authored inline width separately from computed px", () => {
		const runtime = createRuntime();
		const image = new FakeElement("img", "e-1", new FakeElement("body"));
		image.style.width = "50%";
		image.setAttribute("data-wandit-placeholder", "1");

		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image));
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					inlineWidth: "50%",
					isPlaceholderImage: true,
					styles: expect.objectContaining({
						height: "100px",
						width: "100px",
					}),
				}),
			}),
			"*",
		);
	});

	it("builds a leaf-surface-section ladder, cycles within tolerance, and resets when moved", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "pricing", body);
		const surface = new FakeElement("article", "price-card", section);
		surface.computedStyle.backgroundColor = "rgba(255, 255, 255, 1)";
		const leaf = new FakeElement("p", "e-12", surface);
		leaf.innerText = "Professional plan";
		runtime.setHitStack([leaf, surface, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		const selected = (x: number, y: number) => {
			runtime.parent.postMessage.mockClear();
			runtime.dispatchDocument("click", clickEvent(leaf, x, y));
			const message = runtime.parent.postMessage.mock.calls.find(
				([payload]) => (payload as { type?: string }).type === "select",
			)?.[0] as { payload: Record<string, unknown> } | undefined;
			return message?.payload;
		};

		expect(selected(20, 20)).toMatchObject({
			wid: "e-12",
			kind: "element",
			ladderIndex: 0,
			ladder: [
				{ wid: "e-12", kind: "element" },
				{ wid: "price-card", kind: "surface" },
				{ wid: "pricing", kind: "section" },
			],
		});
		expect(selected(23, 22)).toMatchObject({
			wid: "price-card",
			kind: "surface",
			ladderIndex: 1,
		});
		expect(selected(21, 23)).toMatchObject({
			wid: "pricing",
			kind: "section",
			ladderIndex: 2,
		});
		expect(selected(20, 20)).toMatchObject({ wid: "e-12", ladderIndex: 0 });
		expect(selected(30, 20)).toMatchObject({ wid: "e-12", ladderIndex: 0 });
		surface.computedStyle.backgroundColor = "rgba(0, 0, 0, 0)";
		expect(selected(30, 20)).toMatchObject({ wid: "e-12", ladderIndex: 0 });
	});

	it("resolves keyboard clicks from their target without point hit-testing or repeat cycling", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "features", body);
		const surface = new FakeElement("article", "feature-card", section);
		surface.computedStyle.backgroundColor = "white";
		const keyboardLeaf = new FakeElement("button", "keyboard-cta", surface);
		const coordinateLeaf = new FakeElement("p", "coordinate-copy", section);
		runtime.setHitStack([coordinateLeaf, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		for (let attempt = 0; attempt < 2; attempt += 1) {
			runtime.parent.postMessage.mockClear();
			runtime.dispatchDocument("click", {
				...clickEvent(keyboardLeaf, 0, 0),
				detail: 0,
			});
			expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
				expect.objectContaining({
					type: "select",
					payload: expect.objectContaining({
						wid: "keyboard-cta",
						ladderIndex: 0,
						ladder: [
							expect.objectContaining({ wid: "keyboard-cta" }),
							expect.objectContaining({ wid: "feature-card" }),
							expect.objectContaining({ wid: "features" }),
						],
					}),
				}),
				"*",
			);
		}
	});

	it("skips transparent wrappers but treats gradients as surfaces", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const wrapper = new FakeElement("div", "hero-plate", section);
		const leaf = new FakeElement("h1", "e-1", wrapper);
		wrapper.computedStyle.backgroundColor = "rgba(0, 0, 0, 0)";
		runtime.setHitStack([leaf, wrapper, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(leaf, 15, 15));
		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					ladder: [
						expect.objectContaining({ wid: "e-1" }),
						expect.objectContaining({ wid: "hero" }),
					],
				}),
			}),
			"*",
		);

		wrapper.computedStyle.backgroundImage = "linear-gradient(red, blue)";
		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("click", clickEvent(leaf, 30, 30));
		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({
					ladder: expect.arrayContaining([
						expect.objectContaining({
							wid: "hero-plate",
							kind: "surface",
						}),
					]),
				}),
			}),
			"*",
		);
	});

	it("falls through a translucent surface to a lower leaf and keeps the surface in its ladder", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const scrim = new FakeElement("article", "hero-scrim", section);
		scrim.computedStyle.backgroundColor = "rgba(15, 23, 42, 0.45)";
		const image = new FakeElement("img", "hero-image", section);
		image.getBoundingClientRect = () => ({
			left: 0,
			right: 60,
			top: 0,
			bottom: 60,
			width: 60,
			height: 60,
		});
		runtime.setHitStack([scrim, image, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(scrim, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					wid: "hero-image",
					ladder: [
						expect.objectContaining({ wid: "hero-image", kind: "element" }),
						expect.objectContaining({ wid: "hero-scrim", kind: "surface" }),
						expect.objectContaining({ wid: "hero", kind: "section" }),
					],
				}),
			}),
			"*",
		);
	});

	it("falls through a gradient over transparency before promoting a full-bleed hero image", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const scrim = new FakeElement("div", "hero-scrim", section);
		scrim.computedStyle.backgroundColor = "rgba(0, 0, 0, 0)";
		scrim.computedStyle.backgroundImage =
			"linear-gradient(rgba(0, 0, 0, 0.55), transparent)";
		const image = new FakeElement("img", "hero-image", section);
		image.setAttribute("src", "https://assets.example/hero.jpg");
		runtime.setHitStack([scrim, image, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(scrim, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					wid: "hero",
					kind: "section",
					ladder: [expect.objectContaining({ wid: "hero" })],
					bgImage: {
						wid: "hero-image",
						src: "https://assets.example/hero.jpg",
					},
				}),
			}),
			"*",
		);
	});

	it("keeps opaque color and URL-painted surfaces terminal", () => {
		for (const paint of [
			{ backgroundColor: "rgba(255, 255, 255, 1)" },
			{
				backgroundColor: "rgba(0, 0, 0, 0)",
				backgroundImage: 'url("https://assets.example/card.png")',
			},
		]) {
			const runtime = createRuntime();
			const body = new FakeElement("body");
			const section = new FakeElement("section", "features", body);
			const surface = new FakeElement("article", "top-card", section);
			Object.assign(surface.computedStyle, paint);
			const coveredLeaf = new FakeElement("p", "covered-copy", section);
			runtime.setHitStack([surface, coveredLeaf, section]);
			runtime.emitParent("set-mode", { mode: "select" });

			runtime.dispatchDocument("click", clickEvent(surface, 10, 10));

			expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
				expect.objectContaining({
					type: "select",
					payload: expect.objectContaining({
						wid: "top-card",
						kind: "surface",
					}),
				}),
				"*",
			);
		}
	});

	it("keeps a translucent gradient over any opaque image layer terminal", () => {
		for (const backgroundImage of [
			'linear-gradient(rgba(0, 0, 0, 0.45), transparent), url("https://assets.example/hero.jpg")',
			"linear-gradient(rgba(0, 0, 0, 0.45), transparent), linear-gradient(red, blue)",
		]) {
			const runtime = createRuntime();
			const body = new FakeElement("body");
			const section = new FakeElement("section", "hero", body);
			const surface = new FakeElement("article", "hero-surface", section);
			surface.computedStyle.backgroundColor = "rgba(0, 0, 0, 0)";
			surface.computedStyle.backgroundImage = backgroundImage;
			const coveredLeaf = new FakeElement("p", "covered-copy", section);
			runtime.setHitStack([surface, coveredLeaf, section]);
			runtime.emitParent("set-mode", { mode: "select" });

			runtime.dispatchDocument("click", clickEvent(surface, 10, 10));

			expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
				expect.objectContaining({
					type: "select",
					payload: expect.objectContaining({
						wid: "hero-surface",
						kind: "surface",
					}),
				}),
				"*",
			);
		}
	});

	it("does not climb from a transparent overlay to its stamped wrapper during hit scanning", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const wrapper = new FakeElement("article", "overlay-wrapper", section);
		wrapper.computedStyle.backgroundColor = "white";
		const overlay = new FakeElement("div", undefined, wrapper);
		const lowerLeaf = new FakeElement("p", "visible-copy", section);
		runtime.setHitStack([overlay, lowerLeaf, wrapper, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(overlay, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ wid: "visible-copy" }),
			}),
			"*",
		);
	});

	it("starts on an empty surface and lets breadcrumbs select an active stop", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "features", body);
		const surface = new FakeElement("figure", "feature-plate", section);
		surface.computedStyle.backgroundColor = "rgb(250, 250, 250)";
		runtime.elements.set("features", section);
		runtime.elements.set("feature-plate", surface);
		runtime.setHitStack([surface, section]);
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("pointermove", {
			target: surface,
			clientX: 10,
			clientY: 10,
		});
		runtime.dispatchDocument("click", clickEvent(surface, 10, 10));
		const hoverBox = runtime.body.children.find(
			(child) => child.id === "__wandit-hover-box",
		);
		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({
					wid: "feature-plate",
					kind: "surface",
					ladderIndex: 0,
				}),
			}),
			"*",
		);
		expect(hoverBox?.style.display).toBe("block");

		runtime.parent.postMessage.mockClear();
		runtime.emitParent("select-target", { wid: "features" });
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					wid: "features",
					kind: "section",
					ladderIndex: 1,
				}),
			}),
			"*",
		);
		expect(hoverBox?.style.display).toBe("none");

		runtime.dispatchDocument("pointermove", {
			target: surface,
			clientX: 10,
			clientY: 10,
		});
		expect(hoverBox?.style.display).toBe("block");

		runtime.parent.postMessage.mockClear();
		runtime.emitParent("select-target", { wid: "not-in-ladder" });
		expect(runtime.parent.postMessage).not.toHaveBeenCalled();
	});

	it("keeps a topmost empty surface ahead of a covered lower-layer leaf", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "features", body);
		const coveredLeaf = new FakeElement("p", "covered-copy", section);
		const surface = new FakeElement("article", "top-card", section);
		surface.computedStyle.backgroundColor = "rgb(255, 255, 255)";
		runtime.setHitStack([surface, coveredLeaf, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(surface, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({
					wid: "top-card",
					kind: "surface",
				}),
			}),
			"*",
		);
	});

	it("accepts prototype-named semantic wids and bounds accessible labels", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "constructor", body);
		const iconLink = new FakeElement("a", "icon-brand", section);
		iconLink.setAttribute("aria-label", "A".repeat(180));
		runtime.setHitStack([iconLink, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(iconLink, 10, 10));
		const message = runtime.parent.postMessage.mock.calls.find(
			([payload]) => (payload as { type?: string }).type === "select",
		)?.[0] as
			| { payload: { ladder: Array<{ label: string; wid: string }> } }
			| undefined;

		expect(message?.payload.ladder).toHaveLength(2);
		expect(message?.payload.ladder[0]).toMatchObject({ wid: "icon-brand" });
		expect(message?.payload.ladder[0]?.label).toHaveLength(120);
		expect(message?.payload.ladder[1]).toMatchObject({ wid: "constructor" });
	});

	it("does not fall back to hidden text when rendered text is empty", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const leaf = new FakeElement("p", "visible-copy", section);
		leaf.innerText = "";
		leaf.setFallbackTextContent("Hidden fallback copy");
		runtime.setHitStack([leaf, section]);
		runtime.emitParent("set-mode", { mode: "select" });

		runtime.dispatchDocument("click", clickEvent(leaf, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: "select",
				payload: expect.objectContaining({ excerpt: null }),
			}),
			"*",
		);
	});

	it("collapses a full-bleed image to a section-only ladder", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const image = new FakeElement("img", "e-1", section);
		image.setAttribute("src", "https://assets.example/hero.jpg");
		runtime.setHitStack([image, section]);
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("click", clickEvent(image, 10, 10));

		expect(runtime.parent.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({
					wid: "hero",
					kind: "section",
					ladder: [expect.objectContaining({ wid: "hero" })],
					bgImage: {
						wid: "e-1",
						src: "https://assets.example/hero.jpg",
					},
				}),
			}),
			"*",
		);
	});

	it("previews the next ladder stop after selection without pointer movement", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const section = new FakeElement("section", "hero", body);
		const surface = new FakeElement("article", "plate", section);
		const leaf = new FakeElement("p", "e-1", surface);
		surface.computedStyle.backgroundColor = "white";
		leaf.getBoundingClientRect = () => ({
			left: 0,
			right: 40,
			top: 0,
			bottom: 40,
			width: 40,
			height: 40,
		});
		surface.getBoundingClientRect = () => ({
			left: 0,
			right: 70,
			top: 0,
			bottom: 70,
			width: 70,
			height: 70,
		});
		runtime.setHitStack([leaf, surface, section]);
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("pointermove", {
			target: leaf,
			clientX: 10,
			clientY: 10,
		});
		runtime.dispatchDocument("click", clickEvent(leaf, 10, 10));

		const hoverBox = runtime.body.children.find(
			(child) => child.id === "__wandit-hover-box",
		);
		expect(hoverBox?.style.width).toBe("78px");

		runtime.dispatchDocument("click", clickEvent(leaf, 10, 10));
		expect(hoverBox?.style.width).toBe("108px");
	});

	it("mirrors brand logo swaps, preserves the first snapshot, and restores text", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const header = new FakeElement("header", "header", body);
		const brand = new FakeElement("a", "brand-nav", header);
		brand.innerText = "Wandit Studio";
		runtime.elements.set("brand-nav", brand);

		runtime.emitParent("set-brand-logo", {
			wid: "brand-nav",
			value: "https://assets.example/logo.png",
		});
		const firstSnapshot = brand.getAttribute("data-wandit-orig-brand-html");
		const image = brand.querySelector("img[data-wandit-brand-image]");
		expect(firstSnapshot).toBe("Wandit Studio");
		expect(brand.getAttribute("data-wandit-orig-brand-snapshot")).toBe("1");
		expect(brand.getAttribute("data-wandit-brand-logo")).toBe("1");
		expect(brand.getAttribute("data-brand")).toBe("nav");
		expect(image?.getAttribute("src")).toBe("https://assets.example/logo.png");
		expect(image?.getAttribute("alt")).toBe("Wandit Studio");
		expect(image?.style).toMatchObject({
			display: "block",
			maxHeight: "3rem",
			maxWidth: "min(12rem, 40vw)",
			objectFit: "contain",
		});

		runtime.emitParent("set-brand-logo", {
			wid: "brand-nav",
			value: "https://assets.example/logo-2.webp",
		});
		expect(brand.getAttribute("data-wandit-orig-brand-html")).toBe(
			firstSnapshot,
		);
		expect(
			brand.querySelector("img[data-wandit-brand-image]")?.getAttribute("src"),
		).toBe("https://assets.example/logo-2.webp");

		runtime.emitParent("set-brand-logo", { wid: "brand-nav", value: null });
		expect(brand.innerHTML).toBe("Wandit Studio");
		expect(brand.getAttribute("data-wandit-brand-logo")).toBeNull();
		expect(brand.getAttribute("data-wandit-orig-brand-html")).toBeNull();
		expect(brand.getAttribute("data-brand")).toBe("nav");
	});

	it("strips every descendant wid from brand snapshots before restoring HTML", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const header = new FakeElement("header", "header", body);
		const brand = new FakeElement("a", "brand-nav", header);
		const wordmark = new FakeElement("span", "brand-wordmark", brand);
		wordmark.setAttribute("class", "wordmark");
		const emphasis = new FakeElement("strong", "brand-emphasis", wordmark);
		emphasis.innerText = "Wandit";
		runtime.elements.set("brand-nav", brand);

		runtime.emitParent("set-brand-logo", {
			wid: "brand-nav",
			value: "https://assets.example/logo.png",
		});

		const snapshot = brand.getAttribute("data-wandit-orig-brand-html");
		expect(snapshot).toBe(
			'<span class="wordmark"><strong>Wandit</strong></span>',
		);
		expect(snapshot).not.toContain("data-wid");
		expect(wordmark.getAttribute("data-wid")).toBe("brand-wordmark");
		expect(emphasis.getAttribute("data-wid")).toBe("brand-emphasis");

		runtime.emitParent("set-brand-logo", { wid: "brand-nav", value: null });

		expect(brand.innerHTML).toBe(snapshot);
		expect(brand.innerHTML).not.toContain("data-wid");
		expect(brand.querySelectorAll("[data-wid]")).toHaveLength(0);
	});

	it("restores builder-authored brand images from accessible fallback text", () => {
		const runtime = createRuntime();
		const footer = new FakeElement("footer", "footer", new FakeElement("body"));
		const footerNav = new FakeElement("nav", undefined, footer);
		const brand = new FakeElement("a", "brand-footer", footerNav);
		brand.setAttribute("aria-label", "Wandit Studio");
		new FakeElement("img", undefined, brand).setAttribute(
			"alt",
			"Wandit Studio",
		);
		runtime.elements.set("brand-footer", brand);

		runtime.emitParent("set-brand-logo", { wid: "brand-footer", value: null });

		expect(brand.textContent).toBe("Wandit Studio");
		expect(brand.querySelector("img")).toBeNull();
		expect(brand.getAttribute("data-brand")).toBe("footer");
	});

	it("rejects optimistic brand swaps on non-wrapper elements", () => {
		const runtime = createRuntime();
		const heading = new FakeElement(
			"h1",
			"hero-title",
			new FakeElement("header"),
		);
		heading.innerText = "Not the brand wrapper";
		runtime.elements.set("hero-title", heading);

		runtime.emitParent("set-brand-logo", {
			wid: "hero-title",
			value: "https://assets.example/logo.png",
		});

		expect(heading.innerText).toBe("Not the brand wrapper");
		expect(heading.getAttribute("data-brand")).toBeNull();
	});

	it("renders, positions, renumbers, and clears comment pins", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		const first = new FakeElement("article", "price-card", body);
		const second = new FakeElement("p", "price-copy", body);
		first.getBoundingClientRect = () => ({
			left: 20,
			right: 140,
			top: 30,
			bottom: 110,
			width: 120,
			height: 80,
		});
		second.getBoundingClientRect = () => ({
			left: 180,
			right: 260,
			top: 90,
			bottom: 130,
			width: 80,
			height: 40,
		});
		runtime.elements.set("price-card", first);
		runtime.elements.set("price-copy", second);

		runtime.emitParent("set-comment-pins", {
			pins: [
				{ wid: "price-card", number: 1 },
				{ wid: "price-copy", number: 2 },
			],
		});
		const pins = runtime.body.children.filter((child) =>
			child.classNames.has("__wandit-comment-pin"),
		);
		expect(pins).toHaveLength(2);
		expect(pins[0]?.textContent).toBe("1");
		expect(pins[0]?.style).toMatchObject({
			display: "block",
			left: "12px",
			top: "22px",
		});
		expect(pins[1]?.textContent).toBe("2");
		expect(pins[1]?.style).toMatchObject({
			left: "172px",
			top: "82px",
		});
		expect(pins.every((pin) => pin.id.startsWith("__wandit-"))).toBe(true);

		runtime.emitParent("set-comment-pins", {
			pins: [{ wid: "price-copy", number: 1 }],
		});
		const renumbered = runtime.body.children.filter((child) =>
			child.classNames.has("__wandit-comment-pin"),
		);
		expect(renumbered).toHaveLength(1);
		expect(renumbered[0]?.textContent).toBe("1");

		runtime.emitParent("set-comment-pins", { pins: [] });
		expect(
			runtime.body.children.filter((child) =>
				child.classNames.has("__wandit-comment-pin"),
			),
		).toHaveLength(0);
	});

	it("tracks pin layout in RAF, drops stale nodes, and keeps RAF alive for pins only", () => {
		const runtime = createRuntime({ animationFrames: true });
		const target = new FakeElement("p", "price-copy", new FakeElement("body"));
		let left = 30;
		target.getBoundingClientRect = () => ({
			left,
			right: left + 100,
			top: 50,
			bottom: 90,
			width: 100,
			height: 40,
		});
		runtime.elements.set("price-copy", target);

		runtime.emitParent("set-comment-pins", {
			pins: [{ wid: "price-copy", number: 1 }],
		});
		const pin = runtime.body.children.find((child) =>
			child.classNames.has("__wandit-comment-pin"),
		);
		expect(pin?.style.left).toBe("22px");
		expect(runtime.pendingAnimationFrames()).toBe(1);

		left = 75;
		runtime.flushAnimationFrame();
		expect(pin?.style.left).toBe("67px");
		expect(runtime.pendingAnimationFrames()).toBe(1);

		target.isConnected = false;
		runtime.flushAnimationFrame();
		expect(pin?.removed).toBe(true);
		expect(
			runtime.body.children.some((child) =>
				child.classNames.has("__wandit-comment-pin"),
			),
		).toBe(false);
		expect(runtime.pendingAnimationFrames()).toBe(0);
	});

	it("diffs selection rects beyond one pixel and emits one null clear", () => {
		const runtime = createRuntime({ animationFrames: true });
		const target = new FakeElement("p", "price-copy", new FakeElement("body"));
		let rect = {
			left: 20,
			right: 120,
			top: 30,
			bottom: 70,
			width: 100,
			height: 40,
		};
		target.getBoundingClientRect = () => rect;
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.parent.postMessage.mockClear();

		runtime.dispatchDocument("click", clickEvent(target, 30, 40));
		const selectionRects = () =>
			runtime.parent.postMessage.mock.calls
				.map(([message]) => message as { payload: unknown; type: string })
				.filter((message) => message.type === "selection-rect");
		expect(selectionRects()).toHaveLength(0);
		runtime.flushAnimationFrame();
		expect(selectionRects()).toEqual([
			expect.objectContaining({
				payload: {
					wid: "price-copy",
					left: 20,
					top: 30,
					width: 100,
					height: 40,
				},
			}),
		]);

		runtime.flushAnimationFrame();
		expect(selectionRects()).toHaveLength(1);
		rect = { ...rect, left: 21, right: 121 };
		runtime.flushAnimationFrame();
		expect(selectionRects()).toHaveLength(1);
		rect = { ...rect, left: 21.1, right: 121.1 };
		runtime.flushAnimationFrame();
		expect(selectionRects()).toHaveLength(2);
		expect(selectionRects()[1]?.payload).toMatchObject({ left: 21.1 });

		runtime.emitParent("clear-selection", {});
		runtime.emitParent("clear-selection", {});
		runtime.flushAnimationFrame();
		expect(
			selectionRects().filter((message) => message.payload === null),
		).toHaveLength(1);
	});

	it("publishes a clear for zero-width or zero-height selection rects", () => {
		const runtime = createRuntime({ animationFrames: true });
		const target = new FakeElement("p", "price-copy", new FakeElement("body"));
		let rect = {
			left: 20,
			right: 120,
			top: 30,
			bottom: 70,
			width: 100,
			height: 40,
		};
		target.getBoundingClientRect = () => rect;
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.parent.postMessage.mockClear();

		runtime.dispatchDocument("click", clickEvent(target, 30, 40));
		runtime.flushAnimationFrame();
		rect = { ...rect, right: 20, width: 0 };
		runtime.flushAnimationFrame();
		rect = { ...rect, right: 120, width: 100 };
		runtime.flushAnimationFrame();
		rect = { ...rect, bottom: 30, height: 0 };
		runtime.flushAnimationFrame();

		const selectionRects = runtime.parent.postMessage.mock.calls
			.map(([message]) => message as { payload: unknown; type: string })
			.filter((message) => message.type === "selection-rect");
		expect(selectionRects.map((message) => message.payload)).toEqual([
			{
				wid: "price-copy",
				left: 20,
				top: 30,
				width: 100,
				height: 40,
			},
			null,
			{
				wid: "price-copy",
				left: 20,
				top: 30,
				width: 100,
				height: 40,
			},
			null,
		]);
	});

	it("coalesces synchronous selection rect refreshes into one post per RAF", () => {
		const runtime = createRuntime({ animationFrames: true });
		const target = new FakeElement("p", "price-copy", new FakeElement("body"));
		let left = 20;
		target.getBoundingClientRect = () => ({
			left,
			right: left + 100,
			top: 30,
			bottom: 70,
			width: 100,
			height: 40,
		});
		runtime.elements.set("price-copy", target);
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.parent.postMessage.mockClear();

		runtime.dispatchDocument("click", clickEvent(target, 30, 40));
		left = 45;
		runtime.emitParent("set-ai-targets", { wids: ["price-copy"] });
		left = 70;
		runtime.emitParent("set-comment-pins", {
			pins: [{ wid: "price-copy", number: 1 }],
		});

		const selectionRects = () =>
			runtime.parent.postMessage.mock.calls
				.map(([message]) => message as { payload: unknown; type: string })
				.filter((message) => message.type === "selection-rect");
		expect(selectionRects()).toHaveLength(0);

		runtime.flushAnimationFrame();
		expect(selectionRects()).toEqual([
			expect.objectContaining({
				payload: expect.objectContaining({ left: 70, wid: "price-copy" }),
			}),
		]);

		left = 85;
		runtime.emitParent("set-ai-targets", { wids: [] });
		left = 100;
		runtime.emitParent("set-comment-pins", { pins: [] });
		expect(selectionRects()).toHaveLength(1);

		runtime.flushAnimationFrame();
		expect(selectionRects()).toHaveLength(2);
		expect(selectionRects()[1]?.payload).toMatchObject({ left: 100 });
	});

	it("shows one pulsing AI box per target and clears the collection", () => {
		const runtime = createRuntime();
		const body = new FakeElement("body");
		for (const wid of ["price-card", "price-copy"]) {
			runtime.elements.set(wid, new FakeElement("article", wid, body));
		}

		runtime.emitParent("set-ai-targets", {
			wids: ["price-card", "price-copy"],
		});
		const aiBoxes = runtime.body.children.filter((child) =>
			child.classNames.has("__wandit-ai-box"),
		);
		expect(aiBoxes).toHaveLength(2);
		for (const aiBox of aiBoxes) {
			expect(aiBox.style).toMatchObject({
				display: "block",
				height: "108px",
				width: "108px",
			});
			expect(aiBox.classNames.has("__wandit-ai-pulse")).toBe(true);
		}

		runtime.emitParent("set-ai-targets", { wids: [] });
		expect(
			runtime.body.children.some((child) =>
				child.classNames.has("__wandit-ai-box"),
			),
		).toBe(false);
	});

	it("forwards Cmd/Ctrl+K only for an active select-mode target", () => {
		const runtime = createRuntime();
		const leaf = new FakeElement("p", "e-1", new FakeElement("body"));
		const preventDefault = vi.fn();
		const stopPropagation = vi.fn();
		runtime.emitParent("set-mode", { mode: "select" });
		runtime.dispatchDocument("keydown", {
			key: "k",
			metaKey: true,
			preventDefault,
			stopPropagation,
		});
		expect(runtime.parent.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "ask-ai-shortcut" }),
			"*",
		);

		runtime.dispatchDocument("click", clickEvent(leaf));
		runtime.parent.postMessage.mockClear();
		runtime.dispatchDocument("keydown", {
			key: "ن",
			code: "KeyK",
			ctrlKey: true,
			preventDefault,
			stopPropagation,
		});
		expect(preventDefault).toHaveBeenCalled();
		expect(stopPropagation).toHaveBeenCalled();
		expect(runtime.parent.postMessage).toHaveBeenCalledWith(
			{
				source: PREVIEW_MESSAGE_SOURCE,
				v: PREVIEW_PROTOCOL_VERSION,
				type: "ask-ai-shortcut",
				payload: {},
			},
			"*",
		);

		preventDefault.mockClear();
		stopPropagation.mockClear();
		runtime.parent.postMessage.mockClear();
		runtime.emitParent("set-mode", { mode: "edit" });
		runtime.dispatchDocument("keydown", {
			key: "k",
			metaKey: true,
			preventDefault,
			stopPropagation,
		});
		expect(preventDefault).not.toHaveBeenCalled();
		expect(stopPropagation).not.toHaveBeenCalled();
		expect(runtime.parent.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "ask-ai-shortcut" }),
			"*",
		);
	});

	it("applies section background color in the optimistic preview", () => {
		const runtime = createRuntime();
		const section = new FakeElement("section", "hero", new FakeElement("body"));
		runtime.elements.set("hero", section);

		runtime.emitParent("apply-section-style", {
			wid: "hero",
			style: { backgroundColor: "#112233" },
		});

		expect(section.style.backgroundColor).toBe("#112233");
	});
});
