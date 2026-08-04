// Raw async functions for the generated landing page — NO React in here.
// Thin fetch wrappers over the shared api-client; responses parsed with the
// @wandit/contracts Zod schemas so a drifted server shape fails loudly here
// instead of as undefined deeper in the UI.

import {
	type ApplyPageOpsBody,
	type ApplyPageOpsResponse,
	applyPageOpsResponseSchema,
	listPageVersionsResponseSchema,
	type PageOverview,
	type PageVersionHtml,
	type PageVersionListItem,
	pageOverviewSchema,
	pagesRoutes,
	pageVersionHtmlSchema,
	type RestorePageVersionBody,
	type RestorePageVersionResponse,
	restorePageVersionResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/lib/api-client";

/**
 * Everything the Page tab needs in one request: the version to show now and
 * whether a build is in flight. Polled while an attempt is queued/generating
 * (see usePageOverviewQuery).
 */
export async function getPageOverview(
	projectId: string,
): Promise<PageOverview> {
	const data = await apiClient.get<unknown>(pagesRoutes.overview(projectId));
	return pageOverviewSchema.parse(data);
}

/**
 * Full HTML of one version, fetched separately from the overview (it can be
 * hundreds of KB). Versions are immutable, so callers may cache forever.
 */
export async function getVersionHtml(
	versionId: string,
): Promise<PageVersionHtml> {
	const data = await apiClient.get<unknown>(pagesRoutes.versionHtml(versionId));
	return pageVersionHtmlSchema.parse(data);
}

/**
 * Full version history for the project (newest first from the server). Feeds
 * the version switcher, the assets grid, and Settings history. 404/501 fall
 * back to an empty list so the workspace renders while the endpoint rolls out.
 */
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

// ── Edit ops (contract §7.1) ───────────────────────────────────────────────

/** Copy an immutable historical version forward as the new active version.
 * The expected id is a CAS guard against restoring over a concurrently
 * generated or edited page. */
export async function restorePageVersion(
	projectId: string,
	versionId: string,
	body: RestorePageVersionBody,
): Promise<RestorePageVersionResponse> {
	const data = await apiClient.post<unknown>(
		pagesRoutes.restoreVersion(projectId, versionId),
		body,
	);

	return restorePageVersionResponseSchema.parse(data);
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
 * POST one accumulated op batch — ONE new immutable version per call (spec
 * §14). 409/422 become typed errors so use-page-editor can route them to the
 * conflict dialog / failure toast without string matching.
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
				const activeVersionId = readErrorField(
					error.details,
					"activeVersionId",
				);
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
