import type { Project } from "@wandit/contracts";

import type { ProjectQueryRow } from "../persistence/projects.repository";

export function mapProjectRow(row: ProjectQueryRow): Project {
	return {
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		leadCount: row.leadCount,
		metaPixelId: row.metaPixelId,
		name: row.name,
		prompt: row.prompt,
		tiktokPixelId: row.tiktokPixelId,
		...(row.activeSlug ? { publishedSlug: row.activeSlug } : {}),
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
