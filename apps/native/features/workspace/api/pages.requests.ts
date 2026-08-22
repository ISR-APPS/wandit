// Raw fetchers for the generated landing page's HTML + edit-ops endpoints
// (web parity: apps/web/src/features/workspace/api/pages.services.ts). The
// overview/attempt fetchers live in generation.requests.ts — this file adds
// what the PAGE SCREEN needs: version HTML, version history, and the op batch
// that persists manual edits as one new immutable version.

import {
	type ApplyPageOpsBody,
	type ApplyPageOpsResponse,
	applyPageOpsResponseSchema,
	listPageVersionsResponseSchema,
	type PageVersionHtml,
	type PageVersionListItem,
	pagesRoutes,
	pageVersionHtmlSchema,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";
import { isApiClientError } from "@/shared/lib/base-service";

/**
 * Full HTML of one version — hundreds of KB, fetched apart from the overview.
 * Versions are immutable, so callers may cache forever.
 */
export async function getVersionHtml(
	versionId: string,
): Promise<PageVersionHtml> {
	const data = await apiClient.get<unknown>(pagesRoutes.versionHtml(versionId));
	return pageVersionHtmlSchema.parse(data);
}

/** Version history, newest first. Feeds the theme reset (builder-origin
 * lookup); 404/501 degrade to an empty list like the web. */
export async function getPageVersions(
	projectId: string,
): Promise<PageVersionListItem[]> {
	try {
		const data = await apiClient.get<unknown>(pagesRoutes.versions(projectId));
		return listPageVersionsResponseSchema.parse(data).versions;
	} catch (error) {
		if (
			isApiClientError(error) &&
			(error.statusCode === 404 || error.statusCode === 501)
		) {
			return [];
		}
		throw error;
	}
}

/** 409 VERSION_CONFLICT — the base version is no longer active. The UI's
 *  only sane recovery is discard + refetch, so the payload is optional. */
export class PageOpsConflictError extends Error {
	readonly activeVersionId: string | null;

	constructor(message: string, activeVersionId: string | null) {
		super(message);
		this.name = "PageOpsConflictError";
		this.activeVersionId = activeVersionId;
	}
}

/** 422 OP_FAILED — one op could not apply; nothing was written. */
export class PageOpsFailedError extends Error {
	readonly opIndex: number | null;
	readonly reason: string;

	constructor(message: string, opIndex: number | null, reason: string) {
		super(message);
		this.name = "PageOpsFailedError";
		this.opIndex = opIndex;
		this.reason = reason;
	}
}

// The exception filter only guarantees `code` + `message`; the richer payload
// fields (activeVersionId / index / reason) are read defensively if present.
function readErrorField(details: unknown, field: string): unknown {
	return typeof details === "object" && details !== null
		? (details as Record<string, unknown>)[field]
		: undefined;
}

/**
 * POST one accumulated op batch — ONE new immutable version per call. 409/422
 * become typed errors so the editor can route them to the conflict dialog /
 * failure toast without string matching (web parity).
 */
export async function applyPageOps(
	projectId: string,
	body: ApplyPageOpsBody,
): Promise<ApplyPageOpsResponse> {
	try {
		const data = await apiClient.post<unknown>(
			pagesRoutes.applyOps(projectId),
			body,
		);
		return applyPageOpsResponseSchema.parse(data);
	} catch (error) {
		if (isApiClientError(error)) {
			if (error.code === "VERSION_CONFLICT" || error.statusCode === 409) {
				const activeVersionId = readErrorField(error.details, "activeVersionId");
				throw new PageOpsConflictError(
					error.message,
					typeof activeVersionId === "string" ? activeVersionId : null,
				);
			}
			if (error.code === "OP_FAILED" || error.statusCode === 422) {
				const index = readErrorField(error.details, "index");
				const reason = readErrorField(error.details, "reason");
				throw new PageOpsFailedError(
					error.message,
					typeof index === "number" ? index : null,
					typeof reason === "string" ? reason : error.message,
				);
			}
		}
		throw error;
	}
}
