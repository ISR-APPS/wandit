// Resolves a version's pageKey to renderable mock page HTML. Static families
// are keyed directly; "generic-N" keys parameterize a builder on the project
// title (used for versions generated live in the mock workspace).

import { GENERIC_BUILDERS } from "./generic";
import { HONEY_PAGES } from "./honey";
import { MISC_PAGES } from "./misc";
import { SERUM_PAGES } from "./serum";
import type { MockPage } from "./shared";
import { SNEAKERS_PAGES } from "./sneakers";
import { WATCH_PAGES } from "./watch";

const STATIC_PAGES: Record<string, MockPage> = {
	...WATCH_PAGES,
	...HONEY_PAGES,
	...SERUM_PAGES,
	...SNEAKERS_PAGES,
	...MISC_PAGES,
};

export const GENERIC_VARIANT_COUNT = GENERIC_BUILDERS.length;

export function getMockPage(
	pageKey: string,
	ctx?: { title?: string },
): MockPage {
	const staticPage = STATIC_PAGES[pageKey];
	if (staticPage) return staticPage;
	const match = /^generic-(\d+)$/.exec(pageKey);
	const variant = match ? (Number(match[1]) - 1) % GENERIC_BUILDERS.length : 0;
	return GENERIC_BUILDERS[variant]({ title: ctx?.title ?? "Votre produit" });
}

export type { MockPage } from "./shared";
