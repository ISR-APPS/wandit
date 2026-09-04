/**
 * Folds builder tool events into the PageBuildProgress object the chat card
 * renders, and publishes every change (the task wires publish to Trigger run
 * metadata, which Realtime pushes to the card).
 *
 * Runs inside the Trigger worker (no Nest). Progress is best-effort by
 * design: every handler swallows its own failures — a broken thumbnail
 * upload or a publish hiccup must never fail a build that is otherwise
 * succeeding.
 */
import type { PageBuildProgress } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import * as cheerio from "cheerio";

import {
	publicAssetUrl,
	putSiteFile,
	siteShotKey,
} from "../../../../infrastructure/storage/r2";

import {
	type BuilderPageKind,
	REQUIRED_SCREENSHOT_PASSES_BY_KIND,
} from "./site-builder-agent";

export type BuildProgressEvent =
	| { type: "image-start"; role: string }
	| { type: "image-generated"; role: string; url: string }
	| { type: "write-start" }
	| {
			type: "page-written";
			html: string;
			bytes: number;
			kind: "write" | "edit";
	  }
	| {
			type: "screenshot-start";
			pass: number;
	  }
	| {
			type: "screenshot-pass";
			pass: number;
			shots: Array<{ base64: string; viewport: "desktop" | "mobile" }>;
			consoleErrors: string[];
			failedRequests: string[];
			overflow: { desktop: number; mobile: number };
	  }
	| { type: "finished"; summary: string };

/** Uploads one review shot; resolves to its public URL, or null on failure. */
export type ShotUploader = (shot: {
	base64: string;
	index: number;
	pass: number;
}) => Promise<string | null>;

export type BuildProgressTracker = {
	emit: (event: BuildProgressEvent) => void;
	/** Resolves once queued async work (shot uploads) has drained. */
	idle: () => Promise<void>;
};

// The card shows a small strip per pass — uploading all 14 capture shots
// would be waste. Desktop carries the layout story, mobile the responsive one.
const MAX_DESKTOP_SHOTS = 4;
const MAX_MOBILE_SHOTS = 2;

const MAX_SECTIONS = 12;
const MAX_IMAGES = 12;
const MAX_FINDINGS = 6;
const SECTION_LABEL_MAX = 24;

export function createBuildProgressTracker(params: {
	/** R2 asset namespace for this run (the namespaced attempt id). */
	attemptId: string;
	/** Sets the card's review-pass target (COD runs more passes than landing). */
	pageKind?: BuilderPageKind;
	projectId: string;
	publish: (progress: PageBuildProgress) => void;
	uploadShot?: ShotUploader;
}): BuildProgressTracker {
	const uploadShot: ShotUploader =
		params.uploadShot ??
		(async ({ base64, index, pass }) => {
			// Same guard as generate-image: without a public base URL,
			// publicAssetUrl would return a RELATIVE path — skip the strip
			// entirely rather than publish URLs no browser can load.
			if (!env.R2_PUBLIC_BASE_URL) return null;

			try {
				const key = siteShotKey(
					params.projectId,
					params.attemptId,
					pass,
					index,
				);
				await putSiteFile(key, Buffer.from(base64, "base64"), "image/jpeg");

				return publicAssetUrl(key);
			} catch {
				return null;
			}
		});

	const progress: PageBuildProgress = {
		done: false,
		findings: [],
		fixes: 0,
		headline: "Reading the brief…",
		images: [],
		pageBytes: 0,
		percent: 3,
		phase: "starting",
		reviewPasses: 0,
		reviewTarget: REQUIRED_SCREENSHOT_PASSES_BY_KIND[params.pageKind ?? "website"],
		sections: [],
		shots: [],
	};

	// Raw estimate BEFORE the monotonic clamp — regressions (an image failing
	// after reserving budget) must not drag the published bar backwards.
	let estimate = 3;

	const publishNow = () => {
		estimate = Math.max(estimate, progress.percent);
		progress.percent = progress.done ? 100 : Math.min(97, estimate);

		try {
			params.publish({ ...progress });
		} catch {
			// Publishing is telemetry, never build-critical.
		}
	};

	// Light the card up immediately: a high-reasoning builder can think for
	// minutes before its first tool call, and until something is published
	// the chat card has nothing to show.
	publishNow();

	// Shot uploads are async; everything else is sync. Serialize the async
	// work so two passes cannot interleave their strips.
	let chain: Promise<unknown> = Promise.resolve();

	// Only the thumbnail uploads run async (serialized on the chain); every
	// other pass field folds synchronously in emit() so a fix edit arriving
	// while the uploads are still in flight can never be misclassified and a
	// late upload can never rewind the phase or headline.
	const handleShotUploads = async (
		event: Extract<BuildProgressEvent, { type: "screenshot-pass" }>,
	) => {
		const desktop = event.shots
			.filter((shot) => shot.viewport === "desktop")
			.slice(0, MAX_DESKTOP_SHOTS);
		const mobile = event.shots
			.filter((shot) => shot.viewport === "mobile")
			.slice(0, MAX_MOBILE_SHOTS);

		const uploaded = await Promise.all(
			[...desktop, ...mobile].map(async (shot, index) => {
				const url = await uploadShot({
					base64: shot.base64,
					index: index + 1,
					pass: event.pass,
				});

				return url === null ? null : { url, viewport: shot.viewport };
			}),
		);

		const shots = uploaded.filter(
			(shot): shot is { url: string; viewport: "desktop" | "mobile" } =>
				shot !== null,
		);

		if (shots.length > 0) {
			progress.shots = shots;
			publishNow();
		}
	};

	const emit = (event: BuildProgressEvent): void => {
		try {
			// The build is sealed after an accepted finish (write_file throws,
			// but its onInputStart hook still fires for the refused attempt) —
			// nothing may disturb the terminal snapshot.
			if (progress.done) return;

			switch (event.type) {
				case "image-start":
					progress.headline = "Generating the product art…";
					progress.phase = "art";
					publishNow();
					break;
				case "image-generated":
					if (progress.images.length < MAX_IMAGES) {
						progress.images = [
							...progress.images,
							{ role: event.role, url: event.url },
						];
					}
					progress.headline = "Generating the product art…";
					progress.phase = "art";
					estimate = Math.max(estimate, 3 + progress.images.length * 4);
					publishNow();
					break;
				case "write-start":
					progress.headline = "Writing the page…";
					progress.phase = "writing";
					estimate = Math.max(estimate, 30);
					publishNow();
					break;
				case "page-written": {
					const isFix = event.kind === "edit" && progress.reviewPasses > 0;

					if (isFix) progress.fixes += 1;
					progress.pageBytes = event.bytes;
					progress.sections = parseSections(event.html);
					progress.headline = isFix
						? "Applying fixes…"
						: "Reviewing its own work…";
					progress.phase = isFix ? "fixing" : "reviewing";
					estimate = Math.max(estimate + 1, event.kind === "write" ? 55 : 0);
					publishNow();
					break;
				}
				case "screenshot-start":
					progress.currentPass = event.pass;
					progress.headline = "Screenshotting the page to review it…";
					progress.phase = "reviewing";
					publishNow();
					break;
				case "screenshot-pass":
					progress.currentPass = event.pass;
					progress.reviewPasses = Math.max(progress.reviewPasses, event.pass);
					progress.findings = humanizeFindings(event);
					progress.headline = "Reviewing the renders…";
					progress.phase = "reviewing";
					estimate = Math.max(
						estimate,
						event.pass === 1 ? 70 : event.pass === 2 ? 85 : estimate + 3,
					);
					publishNow();
					chain = chain.then(() =>
						handleShotUploads(event).catch(() => undefined),
					);
					break;
				case "finished":
					progress.done = true;
					progress.headline = "Publishing the page…";
					progress.phase = "finishing";
					// Publish AFTER pending shot uploads so the terminal update
					// (done + 100%) is guaranteed to be the last one pushed.
					chain = chain.then(publishNow, publishNow);
					break;
			}
		} catch {
			// Progress is best-effort — never let it break the build loop.
		}
	};

	return {
		emit,
		idle: () => chain.then(() => undefined),
	};
}

/** Deterministic render diagnostics — empty when the pass came back clean. */
function humanizeFindings(
	event: Extract<BuildProgressEvent, { type: "screenshot-pass" }>,
): string[] {
	const findings: string[] = [];

	if (event.consoleErrors.length > 0) {
		findings.push(
			event.consoleErrors.length === 1
				? "1 console error"
				: `${event.consoleErrors.length} console errors`,
		);
	}

	if (event.failedRequests.length > 0) {
		findings.push(
			event.failedRequests.length === 1
				? "1 failed request"
				: `${event.failedRequests.length} failed requests`,
		);
	}

	if (event.overflow.desktop > 1) {
		findings.push(
			`Horizontal overflow on desktop (${event.overflow.desktop}px)`,
		);
	}

	if (event.overflow.mobile > 1) {
		findings.push(`Horizontal overflow on mobile (${event.overflow.mobile}px)`);
	}

	return findings.slice(0, MAX_FINDINGS);
}

/**
 * Section chips for the card, parsed from the page the builder just wrote.
 * Per top-level <section>: aria-label, then a humanized id, then the first
 * heading inside. Pages without <section> tags fall back to their h2 texts.
 */
export function parseSections(html: string): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();

	const push = (raw: string | undefined) => {
		const collapsed = (raw ?? "").replace(/\s+/g, " ").trim();

		if (!collapsed) return;

		const clipped =
			collapsed.length > SECTION_LABEL_MAX
				? `${collapsed.slice(0, SECTION_LABEL_MAX).trimEnd()}…`
				: collapsed;
		const key = clipped.toLowerCase();

		if (seen.has(key)) return;
		seen.add(key);
		labels.push(clipped);
	};

	try {
		const $ = cheerio.load(html);
		const sections = $("section");

		if (sections.length > 0) {
			sections.each((_, element) => {
				const $section = $(element);

				push(
					$section.attr("aria-label") ??
						humanizeId($section.attr("id")) ??
						$section.find("h1, h2, h3").first().text(),
				);
			});
		} else {
			$("h2").each((_, element) => {
				push($(element).text());
			});
		}
	} catch {
		return [];
	}

	return labels.slice(0, MAX_SECTIONS);
}

/** "cod-form" → "Cod form"; empty/missing ids fall through to the heading. */
function humanizeId(id: string | undefined): string | undefined {
	const cleaned = (id ?? "").replace(/[-_]+/g, " ").trim();

	if (!cleaned) return undefined;

	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
