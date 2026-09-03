/**
 * Reconciles attribute-driven interactive features with their pinned inline
 * runtime payloads. Plain domain module: no NestJS or infrastructure imports.
 */

import * as cheerio from "cheerio";

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

interface Payload {
	id: string;
	source: string;
}

interface Feature {
	marker: string;
	css?: Payload;
	js?: Payload;
}

const FEATURES: readonly Feature[] = [
	{
		marker: "data-wandit-toast",
		css: { id: "wandit-feature-toastify-css", source: TOASTIFY_MIN_CSS },
		js: { id: "wandit-feature-toastify-js", source: TOASTIFY_MIN_JS },
	},
	{
		marker: "data-wandit-carousel",
		css: { id: "wandit-feature-splide-css", source: SPLIDE_MIN_CSS },
		js: { id: "wandit-feature-splide-js", source: SPLIDE_MIN_JS },
	},
	{
		marker: "data-wandit-lightbox",
		css: { id: "wandit-feature-glightbox-css", source: GLIGHTBOX_MIN_CSS },
		js: { id: "wandit-feature-glightbox-js", source: GLIGHTBOX_MIN_JS },
	},
	{
		marker: "data-wandit-counter",
		js: { id: "wandit-feature-countup-js", source: COUNTUP_UMD_JS },
	},
	{
		marker: "data-wandit-phone-mask",
		js: { id: "wandit-feature-imask-js", source: IMASK_MIN_JS },
	},
	{
		marker: "data-wandit-confetti",
		js: { id: "wandit-feature-confetti-js", source: CANVAS_CONFETTI_JS },
	},
	{ marker: "data-wandit-countdown" },
	{ marker: "data-wandit-stock-counter" },
	{ marker: "data-wandit-whatsapp-float" },
];

const STARTER: Payload = {
	id: "wandit-feature-starter-js",
	source: WANDIT_FEATURE_STARTER_JS,
};

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
	STARTER.id,
] as const;

/**
 * Remove stale managed blocks, detect live feature-marker attributes, then
 * append exactly the payloads those markers need. The starter is always the
 * final body script and is omitted when the page has no live feature marker.
 */
export function reconcileFeatureShelf(html: string): string {
	const $ = cheerio.load(html);
	let removedManagedBlock = false;

	for (const id of MANAGED_IDS) {
		const blocks = $(`[id="${id}"]`);
		removedManagedBlock ||= blocks.length > 0;
		blocks.remove();
	}

	const activeFeatures = FEATURES.filter(
		(feature) => $(`[${feature.marker}]`).length > 0,
	);

	if (activeFeatures.length === 0) {
		return removedManagedBlock ? $.html() : html;
	}

	for (const feature of activeFeatures) {
		if (feature.css) {
			$("head").append(
				`<style id="${feature.css.id}">${feature.css.source}</style>`,
			);
		}
	}

	for (const feature of activeFeatures) {
		if (feature.js) {
			$("body").append(
				`<script id="${feature.js.id}">${feature.js.source}</script>`,
			);
		}
	}

	$("body").append(`<script id="${STARTER.id}">${STARTER.source}</script>`);

	return $.html();
}
