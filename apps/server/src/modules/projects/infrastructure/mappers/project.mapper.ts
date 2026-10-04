/**
 * Maps one `ProjectQueryRow` to the V1 `Project` contract.
 * `ProjectsService` calls it for the list, get, and update answers, and
 * `mapAppProjectRow` builds the V2 answer on top of it.
 */
import type { Project } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type { ProjectQueryRow } from "../persistence/projects.repository";

export function mapProjectRow(row: ProjectQueryRow): Project {
	return {
		createdAt: row.createdAt.toISOString(),
		engine: row.engine,
		hideWanditBadge: row.hideWanditBadge,
		id: row.id,
		leadCount: row.leadCount,
		logoUrl: row.logoUrl,
		metaPixelId: row.metaPixelId,
		name: row.name,
		prompt: row.prompt,
		previewImageUrl: row.previewImageUrl,
		targetPlatform: row.targetPlatform,
		tiktokPixelId: row.tiktokPixelId,
		...(row.activeSlug
			? {
					publishedSlug: row.activeSlug,
					liveUrl: `https://${row.activeSlug}.${env.SITES_DOMAIN}`,
				}
			: {}),
		status: row.activeSlug
			? "published"
			: row.pendingDeploymentCount > 0
				? "publishing"
				: "draft",
		thumbnailSeed: thumbnailSeed(row.id),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function thumbnailSeed(value: string): number {
	let hash = 0;

	for (const char of value) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}

	return hash;
}
