// Request/response types for the workspace api layer. Source of truth will
// be packages/contracts — once the backend lands these become derived
// re-exports (z.infer), never redeclared. Shapes mirror the planned contract:
// messages store AI SDK v7-style parts, versions are immutable pointers to
// generated files, deployments are slug → version pointers, leads carry the
// COD order pipeline.

export type WorkspaceTab =
	| "page"
	| "assets"
	| "marketing"
	| "leads"
	| "settings";

export type MessageRole = "user" | "assistant";

export type TextPart = { type: "text"; text: string };

/** Inline generation card — mirrors the artifact-updated stream event. */
export type GenerationPart = {
	type: "generation";
	status: "running" | "complete";
	/** null while the generation job is still running. */
	versionId: string | null;
	versionNumber: number;
	summary: string;
};

export type MessagePart = TextPart | GenerationPart;

export type ChatMessage = {
	id: string;
	role: MessageRole;
	parts: MessagePart[];
	createdAt: string;
};

export type PageLang = "fr" | "ar" | "en";

/** Immutable generated-page version (points at an R2 key in production). */
export type PageVersion = {
	id: string;
	number: number;
	label: string;
	lang: PageLang;
	/** Mock renderer key resolved by lib/mock-pages. */
	pageKey: string;
	createdAt: string;
};

export type DeploymentState = "draft" | "publishing" | "published";

export type Deployment = {
	state: DeploymentState;
	slug: string | null;
	publishedVersionId: string | null;
	/** Version a publish in flight is targeting — lets an interrupted
	 * publish/rollback recover onto the version that was requested. */
	pendingVersionId: string | null;
	publishedAt: string | null;
};

export type PixelSettings = {
	metaPixelId: string | null;
	tiktokPixelId: string | null;
};

/** Everything the workspace needs for one project, fetched as one unit. */
export type WorkspaceState = {
	messages: ChatMessage[];
	versions: PageVersion[];
	deployment: Deployment;
	pixels: PixelSettings;
};

export type LeadStatus =
	| "to_confirm"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "returned"
	| "cancelled";

export type LeadSource = "facebook" | "tiktok" | "direct";

export type Lead = {
	id: string;
	name: string;
	/** Canonical E.164 (+213…). */
	phone: string;
	wilaya: string;
	commune: string;
	createdAt: string;
	status: LeadStatus;
	source: LeadSource;
};
