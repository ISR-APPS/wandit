// Service for the Page tab's read side: the overview the web polls while a
// build runs, and the HTML of one finished version.
//
// The controller receives HTTP, this service decides the steps, and the
// repository talks to the database. R2 access goes through the plain storage
// module (no Nest wrapper) because the Trigger.dev task shares it.
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	ListPageVersionsResponse,
	PageOverview,
	PageVersionHtml,
} from "@wandit/contracts";
import { pageVersionSourceSchema } from "@wandit/contracts";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { stampHtml } from "../../domain/stamp";
import { PagesRepository } from "../../infrastructure/persistence/pages.repository";

@Injectable()
export class PagesService {
	constructor(
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
	) {}

	// One request answers "what should the Page tab show right now?".
	async overview(scope: ProjectScope, projectId: string): Promise<PageOverview> {
		const rows = await this.pagesRepository.findOverviewByProject(
			scope,
			projectId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!rows) {
			throw new NotFoundException();
		}

		// Map DB rows (Date) to the contract shape (ISO strings).
		return {
			activeVersion: rows.activeVersion
				? {
						createdAt: rows.activeVersion.createdAt.toISOString(),
						id: rows.activeVersion.id,
						number: rows.activeVersion.number,
					}
				: null,
			artifactId: rows.artifactId,
			latestAttempt: rows.latestAttempt
				? {
						createdAt: rows.latestAttempt.createdAt.toISOString(),
						error: rows.latestAttempt.error,
						id: rows.latestAttempt.id,
						status: rows.latestAttempt.status,
						versionId: rows.latestAttempt.versionId,
					}
				: null,
		};
	}

	// Full version history (Settings history, version switcher, rollback).
	async listVersions(
		scope: ProjectScope,
		projectId: string,
	): Promise<ListPageVersionsResponse> {
		const rows = await this.pagesRepository.listVersionsForProject(
			scope,
			projectId,
		);

		if (!rows) {
			throw new NotFoundException();
		}

		return {
			versions: rows.map((row) => ({
				createdAt: row.createdAt.toISOString(),
				id: row.id,
				isBuilderOrigin: versionIsBuilderOrigin(row.meta),
				isLive: row.isLive,
				label: versionLabel(row.meta),
				number: row.number,
				source: versionSource(row.meta),
			})),
		};
	}

	// Full HTML of one immutable version, fetched from R2.
	async versionHtml(
		scope: ProjectScope,
		versionId: string,
	): Promise<PageVersionHtml> {
		const version = await this.pagesRepository.findAccessibleVersionById(
			scope,
			versionId,
		);

		if (!version) {
			throw new NotFoundException();
		}

		const html = await getPageHtml(version.r2Key);

		// Row exists but the object is gone (or R2 unconfigured mid-flight):
		// treat as not found rather than a 500 — the client shows "no page".
		if (html === null) {
			throw new NotFoundException();
		}

		return { html: stampHtml(html), versionId: version.id };
	}
}

function versionIsBuilderOrigin(meta: unknown): boolean {
	const source =
		typeof meta === "object" && meta !== null
			? (meta as Record<string, unknown>).source
			: undefined;

	return source === "builder" || source === undefined || source === null;
}

function versionSource(meta: unknown) {
	if (typeof meta !== "object" || meta === null) {
		return null;
	}

	const parsed = pageVersionSourceSchema.safeParse(
		(meta as Record<string, unknown>).source,
	);

	return parsed.success ? parsed.data : null;
}

// Human summary from a version's build metadata: the builder's own summary
// when the AI generated it, an edit count for inline-editor batches.
function versionLabel(meta: unknown): string | null {
	if (typeof meta !== "object" || meta === null) {
		return null;
	}

	const record = meta as Record<string, unknown>;

	if (typeof record.builderSummary === "string" && record.builderSummary) {
		return record.builderSummary;
	}

	if (Array.isArray(record.ops) && record.ops.length > 0) {
		const count = record.ops.length;

		return count === 1 ? "1 manual edit" : `${count} manual edits`;
	}

	return null;
}
