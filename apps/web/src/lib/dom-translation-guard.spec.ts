// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { installDomTranslationGuard } from "./dom-translation-guard";

beforeEach(() => {
	document.body.innerHTML = "";
	installDomTranslationGuard();
});

/**
 * What Chrome's translator does to `<p>Hello<span/></p>`: the text node is
 * detached and `<font><font>Bonjour</font></font>` takes its place.
 */
function translateLikeChrome(parent: Element, text: Text) {
	const outer = document.createElement("font");
	const inner = document.createElement("font");
	inner.textContent = "Bonjour";
	outer.appendChild(inner);
	parent.replaceChild(outer, text);
	return outer;
}

function paragraphWithText() {
	const parent = document.createElement("p");
	const text = document.createTextNode("Hello");
	const caret = document.createElement("span");
	parent.appendChild(text);
	parent.appendChild(caret);
	document.body.appendChild(parent);
	return { parent, text, caret };
}

describe("installDomTranslationGuard", () => {
	it("is a no-op when nothing was translated", () => {
		const { parent, text, caret } = paragraphWithText();
		const inserted = document.createElement("b");

		expect(parent.insertBefore(inserted, caret)).toBe(inserted);
		expect(Array.from(parent.childNodes)).toEqual([text, inserted, caret]);

		expect(parent.removeChild(text)).toBe(text);
		expect(Array.from(parent.childNodes)).toEqual([inserted, caret]);
	});

	it("skips the removal of a text node the translator detached", () => {
		const { parent, text, caret } = paragraphWithText();
		const wrapper = translateLikeChrome(parent, text);

		expect(() => parent.removeChild(text)).not.toThrow();
		expect(parent.removeChild(text)).toBe(text);
		expect(Array.from(parent.childNodes)).toEqual([wrapper, caret]);
	});

	it("appends when the reference node was detached by the translator", () => {
		const { parent, text, caret } = paragraphWithText();
		const wrapper = translateLikeChrome(parent, text);
		const inserted = document.createTextNode("Hello!");

		expect(() => parent.insertBefore(inserted, text)).not.toThrow();
		expect(Array.from(parent.childNodes)).toEqual([wrapper, caret, inserted]);
	});

	it("inserts before the wrapper when the reference was moved into one", () => {
		const { parent, caret } = paragraphWithText();
		// Edge-style: the caret span is moved inside a wrapper instead of
		// being replaced.
		const wrapper = document.createElement("font");
		parent.replaceChild(wrapper, caret);
		wrapper.appendChild(caret);
		const inserted = document.createTextNode("Hello!");

		expect(() => parent.insertBefore(inserted, caret)).not.toThrow();
		expect(parent.childNodes[1]).toBe(inserted);
		expect(parent.childNodes[2]).toBe(wrapper);
	});

	it("still lets the native methods reject a real misuse", () => {
		const parent = document.createElement("div");
		const child = document.createElement("span");
		parent.appendChild(child);

		// Inserting a node before one of its own descendants stays invalid.
		expect(() => child.insertBefore(parent, null)).toThrow();
	});

	it("installs once", () => {
		const { removeChild, insertBefore } = Node.prototype;

		installDomTranslationGuard();

		expect(Node.prototype.removeChild).toBe(removeChild);
		expect(Node.prototype.insertBefore).toBe(insertBefore);
	});
});
