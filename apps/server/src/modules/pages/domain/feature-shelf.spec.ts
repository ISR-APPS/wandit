import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { reconcileFeatureShelf } from "./feature-shelf";
import { CANVAS_CONFETTI_JS } from "./vendor/canvas-confetti-js";
import { COUNTUP_UMD_JS } from "./vendor/countup-umd-js";
import { GLIGHTBOX_MIN_CSS } from "./vendor/glightbox-min-css";
import { GLIGHTBOX_MIN_JS } from "./vendor/glightbox-min-js";
import { IMASK_MIN_JS } from "./vendor/imask-min-js";
import { SPLIDE_MIN_CSS } from "./vendor/splide-min-css";
import { SPLIDE_MIN_JS } from "./vendor/splide-min-js";
import { TOASTIFY_MIN_CSS } from "./vendor/toastify-min-css";
import { TOASTIFY_MIN_JS } from "./vendor/toastify-min-js";
import { WANDIT_FEATURE_STARTER_JS } from "./vendor/wandit-feature-starter-js";

const STARTER_ID = "wandit-feature-starter-js";
const MANAGED_IDS = [
	"wandit-feature-toastify-css",
	"wandit-feature-toastify-js",
	"wandit-feature-splide-css",
	"wandit-feature-splide-js",
	"wandit-feature-glightbox-css",
	"wandit-feature-glightbox-js",
	"wandit-feature-countup-js",
	"wandit-feature-imask-js",
	"wandit-feature-confetti-js",
	STARTER_ID,
] as const;

function page(content: string): string {
	return `<!doctype html><html><head><title>Shelf</title></head><body><main>${content}</main></body></html>`;
}

function injectedIds(html: string): string[] {
	const $ = cheerio.load(html);
	return MANAGED_IDS.filter((id) => $(`[id="${id}"]`).length > 0);
}

describe("reconcileFeatureShelf", () => {
	it.each([
		{
			marker: '<button data-wandit-toast="Saved">Save</button>',
			expected: [
				"wandit-feature-toastify-css",
				"wandit-feature-toastify-js",
				STARTER_ID,
			],
		},
		{
			marker: '<div data-wandit-carousel class="splide"></div>',
			expected: [
				"wandit-feature-splide-css",
				"wandit-feature-splide-js",
				STARTER_ID,
			],
		},
		{
			marker: '<a data-wandit-lightbox="gallery" href="photo.jpg">Open</a>',
			expected: [
				"wandit-feature-glightbox-css",
				"wandit-feature-glightbox-js",
				STARTER_ID,
			],
		},
		{
			marker: '<strong data-wandit-counter="120">120</strong>',
			expected: ["wandit-feature-countup-js", STARTER_ID],
		},
		{
			marker: '<input data-wandit-phone-mask="+{213} 000 00 00 00">',
			expected: ["wandit-feature-imask-js", STARTER_ID],
		},
		{
			marker: '<button data-wandit-confetti="click">Celebrate</button>',
			expected: ["wandit-feature-confetti-js", STARTER_ID],
		},
		{
			marker: '<time data-wandit-countdown="2030-01-01T00:00:00Z"></time>',
			expected: [STARTER_ID],
		},
		{
			marker: '<span data-wandit-stock-counter="12">12</span>',
			expected: [STARTER_ID],
		},
		{
			marker: '<a data-wandit-whatsapp-float="+213555123456">Chat</a>',
			expected: [STARTER_ID],
		},
	])("injects only the payload for $marker", ({ marker, expected }) => {
		expect(injectedIds(reconcileFeatureShelf(page(marker)))).toEqual(expected);
	});

	it("leaves a marker-free page byte-identical", () => {
		const html = page("<p>Static content</p>");

		expect(reconcileFeatureShelf(html)).toBe(html);
	});

	it("puts CSS in head and the starter after every library script", () => {
		const reconciled = reconcileFeatureShelf(
			page(
				'<button data-wandit-toast="Saved">Save</button>' +
					'<div data-wandit-carousel class="splide"></div>' +
					'<a data-wandit-lightbox="gallery"></a>',
			),
		);
		const $ = cheerio.load(reconciled);

		expect($("head > style[id^='wandit-feature-']")).toHaveLength(3);
		expect($("body > script[id^='wandit-feature-']").last().attr("id")).toBe(
			STARTER_ID,
		);
		expect($("body").children().last().attr("id")).toBe(STARTER_ID);
	});

	it("emits every fixed ID exactly once for repeated markers", () => {
		const reconciled = reconcileFeatureShelf(
			page(
				'<button data-wandit-toast="One">One</button>' +
					'<button data-wandit-toast="Two">Two</button>' +
					'<span data-wandit-counter="10"></span>' +
					'<span data-wandit-counter="20"></span>',
			),
		);
		const $ = cheerio.load(reconciled);

		for (const id of [
			"wandit-feature-toastify-css",
			"wandit-feature-toastify-js",
			"wandit-feature-countup-js",
			STARTER_ID,
		]) {
			expect($(`[id="${id}"]`), id).toHaveLength(1);
		}
	});

	it("is idempotent", () => {
		const once = reconcileFeatureShelf(
			page(
				'<button data-wandit-toast="Saved">Save</button>' +
					'<span data-wandit-counter="100">100</span>',
			),
		);

		expect(reconcileFeatureShelf(once)).toBe(once);
	});

	it("removes every managed block after the last marker is removed", () => {
		const withShelf = reconcileFeatureShelf(
			page('<button data-wandit-toast="Saved">Save</button>'),
		);
		const $ = cheerio.load(withShelf);
		$("[data-wandit-toast]").removeAttr("data-wandit-toast");

		expect(injectedIds(reconcileFeatureShelf($.html()))).toEqual([]);
	});

	it("removing one feature preserves another feature's payload", () => {
		const withShelf = reconcileFeatureShelf(
			page(
				'<button data-wandit-toast="Saved">Save</button>' +
					'<span data-wandit-counter="100">100</span>',
			),
		);
		const $ = cheerio.load(withShelf);
		$("[data-wandit-toast]").removeAttr("data-wandit-toast");

		expect(injectedIds(reconcileFeatureShelf($.html()))).toEqual([
			"wandit-feature-countup-js",
			STARTER_ID,
		]);
	});

	it("does not count marker text inside scripts, including a stale starter", () => {
		const html = page(
			'<script>const selector = "[data-wandit-carousel]";</script>' +
				`<script id="${STARTER_ID}">document.querySelector("[data-wandit-toast]")</script>`,
		);
		const reconciled = reconcileFeatureShelf(html);
		const $ = cheerio.load(reconciled);

		expect(injectedIds(reconciled)).toEqual([]);
		expect($("script").first().text()).toContain("data-wandit-carousel");
	});

	it("keeps all injected script and style tags balanced", () => {
		const reconciled = reconcileFeatureShelf(
			page(
				'<button data-wandit-toast="Saved"></button>' +
					"<div data-wandit-carousel></div>" +
					'<a data-wandit-lightbox="gallery"></a>' +
					'<span data-wandit-counter="1"></span>' +
					'<input data-wandit-phone-mask="000">' +
					'<button data-wandit-confetti="click"></button>',
			),
		);

		expect(reconciled.match(/<script\b/g)).toHaveLength(
			(reconciled.match(/<\/script>/g) ?? []).length,
		);
		expect(reconciled.match(/<style\b/g)).toHaveLength(
			(reconciled.match(/<\/style>/g) ?? []).length,
		);
	});
});

describe("feature shelf source escaping", () => {
	it.each([
		["Toastify", TOASTIFY_MIN_JS],
		["Splide", SPLIDE_MIN_JS],
		["GLightbox", GLIGHTBOX_MIN_JS],
		["CountUp", COUNTUP_UMD_JS],
		["IMask", IMASK_MIN_JS],
		["canvas-confetti", CANVAS_CONFETTI_JS],
		["Wandit starter", WANDIT_FEATURE_STARTER_JS],
	])("keeps %s inside one real script element", (_name, source) => {
		expect(source).not.toMatch(/<\/script/i);
		const wrapped = `<script>${source}</script>`;
		const $ = cheerio.load(wrapped);
		expect($("script")).toHaveLength(1);
		expect(wrapped.match(/<script\b/g)).toHaveLength(
			(wrapped.match(/<\/script>/g) ?? []).length,
		);
	});

	it.each([
		["Toastify", TOASTIFY_MIN_CSS],
		["Splide", SPLIDE_MIN_CSS],
		["GLightbox", GLIGHTBOX_MIN_CSS],
	])("keeps %s inside one real style element", (_name, source) => {
		expect(source).not.toMatch(/<\/style/i);
		const wrapped = `<style>${source}</style>`;
		const $ = cheerio.load(wrapped);
		expect($("style")).toHaveLength(1);
		expect(wrapped.match(/<style\b/g)).toHaveLength(
			(wrapped.match(/<\/style>/g) ?? []).length,
		);
	});
});
