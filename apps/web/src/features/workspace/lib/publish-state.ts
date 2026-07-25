// Pure derivations for the publish UI — no React, no network. Kept separate
// from store.tsx so the verdict logic is unit-testable.

import type {
	DeploymentCurrent,
	SlugAvailabilityResponse,
} from "@wandit/contracts";

import { isValidSlug, slugify } from "./helpers";

/**
 * The slug the UI should show before/while editing: the live slug wins, then
 * an unsaved pre-publish choice, then a name-derived guess. The server is the
 * real authority — on first publish it generates its own default when the
 * body omits a slug, so this is display + intent only.
 */
export function displaySlug(
	deployment: DeploymentCurrent | undefined,
	draftSlug: string | null,
	projectName: string | undefined,
): string {
	return deployment?.slug ?? draftSlug ?? slugify(projectName ?? "", "");
}

export type SlugVerdict =
	| "idle"
	| "invalid"
	| "checking"
	| "taken"
	| "reserved"
	| "available";

/** Collapse the availability query state into one renderable verdict. */
export function slugVerdict(input: {
	slug: string;
	dirty: boolean;
	unchanged: boolean;
	checking: boolean;
	availability: SlugAvailabilityResponse | undefined;
}): SlugVerdict {
	if (!input.dirty || input.unchanged) {
		return "idle";
	}

	if (!isValidSlug(input.slug)) {
		return "invalid";
	}

	if (input.checking || !input.availability) {
		return "checking";
	}

	if (!input.availability.available) {
		return input.availability.reason === "reserved" ? "reserved" : "taken";
	}

	return "available";
}

/**
 * Publishing needs a draft version to ship. pendingVersionId is the server's
 * draft pointer, so this stays true even before the version list loads.
 */
export function canPublish(deployment: DeploymentCurrent | undefined): boolean {
	return (
		deployment != null &&
		deployment.pendingVersionId != null &&
		deployment.uiState !== "publishing"
	);
}
