/** Cache keys shared by durable generation cards and future workspace tabs. */
export const pageKeys = {
	all: ["pages"] as const,
	attempt: (projectId: string, attemptId: string) =>
		[...pageKeys.all, "attempt", projectId, attemptId] as const,
	overview: (projectId: string) =>
		[...pageKeys.all, "overview", projectId] as const,
	versionHtml: (versionId: string) =>
		[...pageKeys.all, "version-html", versionId] as const,
	versions: (projectId: string) =>
		[...pageKeys.all, "versions", projectId] as const,
};

export const imageGenerationKeys = {
	all: ["image-generations"] as const,
	attempt: (attemptId: string) =>
		[...imageGenerationKeys.all, "attempt", attemptId] as const,
};

export const marketingAssetKeys = {
	all: ["marketing-assets"] as const,
	html: (assetId: string) =>
		[...marketingAssetKeys.all, "html", assetId] as const,
	list: (projectId: string) =>
		[...marketingAssetKeys.all, "list", projectId] as const,
};

export const leadScrapeKeys = {
	all: ["lead-scrapes"] as const,
	attempt: (attemptId: string) =>
		[...leadScrapeKeys.all, "attempt", attemptId] as const,
};

export const connectorGenerationKeys = {
	all: ["connector-generations"] as const,
	attempt: (attemptId: string) =>
		[...connectorGenerationKeys.all, "attempt", attemptId] as const,
};
