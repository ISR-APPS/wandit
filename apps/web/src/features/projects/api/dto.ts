// Request/response types for this feature's api layer. Source of truth will
// be packages/contracts — once the backend lands these become derived
// re-exports (z.infer), never redeclared. Shapes mirror the planned contract.

export type ProjectStatus = "draft" | "publishing" | "published";

export type Project = {
	id: string;
	name: string;
	prompt: string;
	status: ProjectStatus;
	leadCount: number;
	createdAt: string;
	updatedAt: string;
	thumbnailSeed: number;
	publishedSlug?: string;
};
