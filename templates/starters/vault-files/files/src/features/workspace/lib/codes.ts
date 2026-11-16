// The code lists of Vault: file kinds and their chart categories, teams, share access, share status, and actions.
// Each list becomes a check constraint when the sample rows move to tables (STARTER.md).
// The sample workspace, the read functions, the badges, and the filters read this file.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** Every file kind. The extension of the file name gives the kind (KIND_OF_EXTENSION). */
export const FILE_KINDS = [
	"document",
	"pdf",
	"spreadsheet",
	"presentation",
	"image",
	"video",
	"design",
	"archive",
	"code",
	"audio",
] as const;

/** One file kind. Its label is the message key `fileKinds.<kind>`. */
export type FileKind = (typeof FILE_KINDS)[number];

/** The kind of each extension that the workspace holds. An unknown extension is not in the sample rows. */
export const KIND_OF_EXTENSION = {
	docx: "document",
	md: "document",
	pdf: "pdf",
	xlsx: "spreadsheet",
	csv: "spreadsheet",
	pptx: "presentation",
	png: "image",
	jpg: "image",
	svg: "image",
	mp4: "video",
	mov: "video",
	fig: "design",
	psd: "design",
	ai: "design",
	zip: "archive",
	json: "code",
	yaml: "code",
	sql: "code",
	wav: "audio",
	mp3: "audio",
} as const satisfies Record<string, FileKind>;

/** One extension of KIND_OF_EXTENSION, without the dot. */
export type FileExtension = keyof typeof KIND_OF_EXTENSION;

/** The type filter and the stacked chart group the kinds into these 5 categories, in stack order. */
export const FILE_CATEGORIES = [
	"documents",
	"images",
	"video",
	"design",
	"other",
] as const;

/** One category. Its label is the message key `fileCategories.<category>`. */
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** The category of each kind. Office files, PDFs, and code are documents; archives and audio are other. */
export const CATEGORY_OF_KIND = {
	document: "documents",
	pdf: "documents",
	spreadsheet: "documents",
	presentation: "documents",
	code: "documents",
	image: "images",
	video: "video",
	design: "design",
	archive: "other",
	audio: "other",
} as const satisfies Record<FileKind, FileCategory>;

/** The teams of the workspace. A folder belongs to one team; a member works in one team. */
export const TEAMS = [
	"design",
	"engineering",
	"marketing",
	"sales",
	"operations",
] as const;

/** One team. Its label is the message key `teams.<team>`. */
export type Team = (typeof TEAMS)[number];

/** What a share lets its recipients do, from the least to the most. */
export const SHARE_ACCESS = ["view", "comment", "edit"] as const;

/** One access level. Its label is the message key `shares.access.<access>`. */
export type ShareAccess = (typeof SHARE_ACCESS)[number];

/** The state of a share at the current time. readShareStatus in workspace.ts derives it from the expiry. */
export const SHARE_STATUSES = ["active", "expiring", "expired"] as const;

/** One share state. Its label is the message key `shares.statuses.<status>`. */
export type ShareStatus = (typeof SHARE_STATUSES)[number];

/** The actions of the activity feed, in the order of the Recent page tabs. */
export const ACTIVITY_ACTIONS = [
	"uploaded",
	"updated",
	"shared",
	"deleted",
] as const;

/** One action. Its label is the message key `activity.actions.<action>`. */
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per share state. Expiring needs action soon; expired is closed. */
export const SHARE_STATUS_BADGE = {
	active: "success",
	expiring: "warning",
	expired: "outline",
} satisfies Record<ShareStatus, BadgeVariant>;

/** Badge variant per access level. Edit is the widest right, so it stands out. */
export const SHARE_ACCESS_BADGE = {
	view: "secondary",
	comment: "secondary",
	edit: "info",
} satisfies Record<ShareAccess, BadgeVariant>;
