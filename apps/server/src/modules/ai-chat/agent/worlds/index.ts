/**
 * The design-worlds library — the product's deep taste, written in advance.
 *
 * Each world is a complete visual universe (see types.ts). The Brain offers
 * worlds in its candidate menu and passes the chosen id to generate_page;
 * the queue tool appends the world's doc verbatim to the builder's system
 * prompt snapshot. Authored once with care, delivered whole every build —
 * never improvised, never summarized.
 *
 * Anti-convergence: the menu is SAMPLED, not listed. Every call shuffles a
 * fresh subset per section (industry-affine worlds guaranteed a seat), so
 * two similar businesses meet different menus — the same mechanism as
 * directions.ts, one level up.
 */

import { atelier } from "./atelier";
import { bazar } from "./bazar";
import { beton } from "./beton";
import { cargo } from "./cargo";
import { cinetique } from "./cinetique";
import { clarte } from "./clarte";
import { cocon } from "./cocon";
import { codWorlds } from "./cod";
import { forge } from "./forge";
import { fournil } from "./fournil";
import { heritage } from "./heritage";
import { laboratoire } from "./laboratoire";
import { monographe } from "./monographe";
import { nid } from "./nid";
import { nocturne } from "./nocturne";
import { palestre } from "./palestre";
import { pellicule } from "./pellicule";
import { precis } from "./precis";
import { ribambelle } from "./ribambelle";
import { riviera } from "./riviera";
import { sillage } from "./sillage";
import type { DesignWorld } from "./types";
import { verger } from "./verger";
import { vitrine } from "./vitrine";
import { zellige } from "./zellige";

export type { DesignWorld } from "./types";

export const designWorlds: DesignWorld[] = [
	atelier,
	bazar,
	beton,
	cargo,
	cinetique,
	clarte,
	cocon,
	forge,
	fournil,
	heritage,
	laboratoire,
	monographe,
	nid,
	nocturne,
	palestre,
	pellicule,
	precis,
	ribambelle,
	riviera,
	sillage,
	verger,
	vitrine,
	zellige,
	...codWorlds,
];

export function getWorld(id: string): DesignWorld | undefined {
	const needle = id.trim().toLowerCase();
	return designWorlds.find((world) => world.id === needle);
}

const norm = (value: string) => value.trim().toLowerCase();
// Light stemming so "agency" matches "agencies" — substring alone misses it.
const stem = (value: string) =>
	value.endsWith("ies") ? `${value.slice(0, -3)}y` : value.replace(/e?s$/u, "");

function matchesAny(
	tags: readonly string[] | undefined,
	needles: readonly string[],
): boolean {
	if (!tags?.length || !needles.length) return false;
	return tags.some((tag) =>
		needles.some((needle) => {
			const a = norm(tag);
			const b = norm(needle);
			return a.includes(b) || b.includes(a) || stem(a) === stem(b);
		}),
	);
}

function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const swapped = out[i] as T;
		out[i] = out[j] as T;
		out[j] = swapped;
	}
	return out;
}

// 6 per section: enough range for a real choice and for taste questions,
// small enough that the menu stays readable and two calls rarely coincide.
const MENU_SIZE = 6;
// Affine worlds get at most half the menu, so strong industry fit never
// crowds out the surprising pick.
const MAX_AFFINE_SEATS = 3;

const COD_MENU_SIZE = 8;
const COD_MAX_AFFINE_SEATS = 4;

function sampleSection(pool: DesignWorld[], hints: string[]): DesignWorld[] {
	const eligible = pool.filter((world) => !matchesAny(world.avoidFor, hints));
	const usable = eligible.length > 0 ? eligible : pool;
	const affine = shuffle(usable.filter((w) => matchesAny(w.industries, hints)));
	const seated = affine.slice(0, MAX_AFFINE_SEATS);
	const rest = shuffle(usable.filter((w) => !seated.includes(w)));
	return shuffle([...seated, ...rest.slice(0, MENU_SIZE - seated.length)]);
}

function worldsFuse(left: DesignWorld, right: DesignWorld): boolean {
	return (
		left.fusesWith?.includes(right.id) === true ||
		right.fusesWith?.includes(left.id) === true
	);
}

function countFusablePairs(worlds: DesignWorld[]): number {
	let count = 0;
	for (let leftIndex = 0; leftIndex < worlds.length; leftIndex++) {
		for (
			let rightIndex = leftIndex + 1;
			rightIndex < worlds.length;
			rightIndex++
		) {
			const left = worlds[leftIndex];
			const right = worlds[rightIndex];
			if (left && right && worldsFuse(left, right)) count++;
		}
	}
	return count;
}

function sampleCodSection(pool: DesignWorld[], hints: string[]): DesignWorld[] {
	const eligible = pool.filter((world) => !matchesAny(world.avoidFor, hints));
	const usable = eligible.length > 0 ? eligible : pool;
	const affine = shuffle(usable.filter((w) => matchesAny(w.industries, hints)));
	const seated = affine.slice(0, COD_MAX_AFFINE_SEATS);
	const remaining = shuffle(usable.filter((w) => !seated.includes(w)));

	// Fill the non-affine seats with compatible donors first. If the seated
	// worlds have no partner left, seed a compatible pair from the remainder.
	// Four open seats are enough to guarantee two pairs whenever the eligible
	// pool contains them, even when none of the affine worlds participate.
	while (seated.length < COD_MENU_SIZE && countFusablePairs(seated) < 2) {
		const partnerIndex = remaining.findIndex((candidate) =>
			seated.some((world) => worldsFuse(world, candidate)),
		);
		if (partnerIndex >= 0) {
			const [partner] = remaining.splice(partnerIndex, 1);
			if (partner) seated.push(partner);
			continue;
		}

		if (COD_MENU_SIZE - seated.length < 2) break;
		let pairIndexes: readonly [number, number] | undefined;
		for (let leftIndex = 0; leftIndex < remaining.length; leftIndex++) {
			for (
				let rightIndex = leftIndex + 1;
				rightIndex < remaining.length;
				rightIndex++
			) {
				const left = remaining[leftIndex];
				const right = remaining[rightIndex];
				if (left && right && worldsFuse(left, right)) {
					pairIndexes = [leftIndex, rightIndex];
					break;
				}
			}
			if (pairIndexes) break;
		}

		if (!pairIndexes) break;
		const [leftIndex, rightIndex] = pairIndexes;
		const [right] = remaining.splice(rightIndex, 1);
		const [left] = remaining.splice(leftIndex, 1);
		if (left) seated.push(left);
		if (right) seated.push(right);
	}

	seated.push(...remaining.slice(0, COD_MENU_SIZE - seated.length));
	return shuffle(seated);
}

function formatWorld(world: DesignWorld, hints: string[]): string {
	const fit = matchesAny(world.industries, hints)
		? " · STRONG FIT for this business"
		: "";
	return (
		`- ${world.id} — "${world.name}" (${world.energy}, ${world.priceFeel}; ` +
		`mood: ${world.mood.join(", ")})${fit}\n  ${world.tagline}`
	);
}

function formatCodWorld(world: DesignWorld, hints: string[]): string {
	const fit = matchesAny(world.industries, hints)
		? " · STRONG FIT for this business"
		: "";
	const fusesWith = world.fusesWith?.join(", ") || "none listed";
	const skin = world.preview
		? `${world.preview.ground}/${world.preview.ink}/${world.preview.accent}, ${world.preview.fontFamily}`
		: "not specified";
	return (
		`- ${world.id} — "${world.name}" (${world.energy}, ${world.priceFeel}; ` +
		`mood: ${world.mood.join(", ")}) · fuses with: ${fusesWith} · skin: ${skin}${fit}\n  ${world.tagline}`
	);
}

/**
 * Format the sampled world menu for the Brain's candidate tool result: one
 * section per build type. The sampling randomness lives HERE, never in the
 * model — same anti-convergence contract as sampleCandidates.
 */
export function formatWorldCandidates(params: {
	business: string;
	industryHints?: string[];
	pageKind?: "website" | "product" | "cod";
}): string {
	const hints = [params.business, ...(params.industryHints ?? [])];
	if (params.pageKind === "cod") {
		const worlds = sampleCodSection(
			designWorlds.filter((world) => world.kind === "cod"),
			hints,
		);
		return `## COD FUNNEL WORLDS — one coherent visual universe, freshly sampled
Pick ONE BASE + 2-3 DONORS from this menu. Prefer donors from the base's fuses with list or worlds sharing its mood. Pass the ids to generate_page.worldIds in base-first order and set pageKind: "cod".
${worlds.map((world) => formatCodWorld(world, hints)).join("\n")}`;
	}

	const websiteWorlds = sampleSection(
		designWorlds.filter((w) => w.kind === "website" || w.kind === "both"),
		hints,
	);
	const productWorlds = sampleSection(
		designWorlds.filter((w) => w.kind === "product" || w.kind === "both"),
		hints,
	);

	return `## DESIGN WORLDS — the page's visual universe (freshly sampled; the builder receives the chosen world's full design bible automatically — you never restate it: your palette hexes, fonts and content live inside its physics)
WEBSITE WORLDS (a multi-section website picks EXACTLY ONE):
${websiteWorlds.map((w) => formatWorld(w, hints)).join("\n")}
PRODUCT-PAGE WORLDS (a single-product presentation page picks ONE when it fits — or none for the classic skeleton path):
${productWorlds.map((w) => formatWorld(w, hints)).join("\n")}`;
}
