// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { installDomTranslationGuard } from "./dom-translation-guard";

/**
 * End-to-end check against the real react-dom commit phase. The first block
 * runs BEFORE the guard is installed and proves that a translated page makes
 * React throw the exact NotFoundError seen in Sentry; the second block
 * installs the guard and proves the same updates then succeed.
 */

beforeAll(() => {
	// React's act() reads this global.
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(async () => {
	if (root) {
		const current = root;
		await act(async () => {
			current.unmount();
		});
		root = null;
	}
	container?.remove();
	container = null;
});

let setTyped: (value: string) => void = () => {};
let setShowLead: (value: boolean) => void = () => {};

/** The landing typewriter shape: `<p>{typed}<span caret/></p>`. */
function Typewriter() {
	const [typed, set] = useState("Hello");
	setTyped = set;
	return createElement(
		"p",
		{ id: "typewriter" },
		typed,
		createElement("span", { id: "caret" }),
	);
}

/** A conditional element in front of a text node: `<p>{lead}{"tail"}</p>`. */
function LeadThenTail() {
	const [showLead, set] = useState(false);
	setShowLead = set;
	return createElement(
		"p",
		{ id: "lead-then-tail" },
		showLead ? createElement("b", { id: "lead" }, "lead") : null,
		"tail",
	);
}

async function mount(component: () => React.ReactElement) {
	const errors: unknown[] = [];
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container, {
		onUncaughtError: (error) => {
			errors.push(error);
		},
	});
	const current = root;
	await act(async () => {
		current.render(createElement(component));
	});
	return errors;
}

/**
 * Runs a state update inside act() and returns every error React surfaced:
 * React 19 both reports a commit-phase error to onUncaughtError and rethrows
 * it out of act(), so collect both channels.
 */
async function update(errors: unknown[], change: () => void) {
	try {
		await act(async () => {
			change();
		});
	} catch (error) {
		errors.push(error);
	}
	return errors;
}

function names(errors: unknown[]): string[] {
	return errors.map((error) => (error as Error).name);
}

/** Chrome's translator: the text node is replaced by nested <font> wrappers. */
function translateTextNode(text: Text, translated: string) {
	const outer = document.createElement("font");
	const inner = document.createElement("font");
	inner.textContent = translated;
	outer.appendChild(inner);
	text.parentNode?.replaceChild(outer, text);
	return outer;
}

function byId(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`missing #${id}`);
	}
	return element;
}

describe("react-dom on a translated page, without the guard", () => {
	it("throws NotFoundError when React removes a translated text node", async () => {
		const errors = await mount(Typewriter);
		const paragraph = byId("typewriter");
		translateTextNode(paragraph.firstChild as Text, "Bonjour");

		await update(errors, () => setTyped(""));

		expect(names(errors)).toContain("NotFoundError");
	});

	it("throws NotFoundError when React inserts before a translated text node", async () => {
		const errors = await mount(LeadThenTail);
		const paragraph = byId("lead-then-tail");
		translateTextNode(paragraph.firstChild as Text, "queue");

		await update(errors, () => setShowLead(true));

		expect(names(errors)).toContain("NotFoundError");
	});
});

describe("react-dom on a translated page, with the guard", () => {
	beforeAll(() => {
		installDomTranslationGuard();
	});

	it("survives the removal of a translated text node", async () => {
		const errors = await mount(Typewriter);
		const paragraph = byId("typewriter");
		const wrapper = translateTextNode(paragraph.firstChild as Text, "Bonjour");

		await update(errors, () => setTyped(""));

		expect(errors).toHaveLength(0);
		// The translated text stays, the caret stays, React keeps rendering.
		expect(Array.from(paragraph.childNodes)).toEqual([wrapper, byId("caret")]);

		await update(errors, () => setTyped("Hi"));
		expect(errors).toHaveLength(0);
		expect(paragraph.textContent).toContain("Hi");
	});

	it("survives an insert before a translated text node", async () => {
		const errors = await mount(LeadThenTail);
		const paragraph = byId("lead-then-tail");
		const wrapper = translateTextNode(paragraph.firstChild as Text, "queue");

		await update(errors, () => setShowLead(true));

		expect(errors).toHaveLength(0);
		expect(paragraph.contains(byId("lead"))).toBe(true);
		expect(paragraph.contains(wrapper)).toBe(true);

		await update(errors, () => setShowLead(false));
		expect(errors).toHaveLength(0);
		expect(document.getElementById("lead")).toBeNull();
	});
});
