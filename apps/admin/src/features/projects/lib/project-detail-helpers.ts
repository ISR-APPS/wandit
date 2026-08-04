import type { AdminProjectAsset } from "@/features/projects/api/projects.dto";

export type StatusBadgeVariant =
	| "default"
	| "destructive"
	| "outline"
	| "secondary";

const POSITIVE_STATUSES = new Set([
	"active",
	"confirmed",
	"connected",
	"delivered",
	"published",
	"succeeded",
]);

const NEGATIVE_STATUSES = new Set([
	"cancelled",
	"expired",
	"failed",
	"returned",
	"transferred_out",
]);

const IN_PROGRESS_STATUSES = new Set([
	"configuring",
	"generating",
	"pending",
	"publishing",
	"queued",
	"registering",
	"running",
	"shipped",
]);

export function titleCase(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function statusBadgeVariant(status: string): StatusBadgeVariant {
	if (NEGATIVE_STATUSES.has(status)) {
		return "destructive";
	}

	if (POSITIVE_STATUSES.has(status)) {
		return "default";
	}

	if (IN_PROGRESS_STATUSES.has(status)) {
		return "secondary";
	}

	return "outline";
}

export function formatProjectDate(
	value: string | null,
	options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "short",
		year: "numeric",
	},
) {
	if (!value) {
		return "—";
	}

	return new Intl.DateTimeFormat("en-US", options).format(new Date(value));
}

export function formatProjectDateTime(value: string | null) {
	return formatProjectDate(value, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function formatWholeNumber(value: number) {
	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatFileSize(value: number | null) {
	if (value === null) {
		return "—";
	}

	if (value < 1_024) {
		return `${value} B`;
	}

	const units = ["KB", "MB", "GB"] as const;
	let size = value / 1_024;
	let unitIndex = 0;

	while (size >= 1_024 && unitIndex < units.length - 1) {
		size /= 1_024;
		unitIndex += 1;
	}

	return `${new Intl.NumberFormat("en-US", {
		maximumFractionDigits: size >= 10 ? 0 : 1,
	}).format(size)} ${units[unitIndex]}`;
}

export function isImageAsset(asset: AdminProjectAsset) {
	return asset.kind === "image" || asset.mediaType.startsWith("image/");
}

export function isVideoAsset(asset: AdminProjectAsset) {
	return asset.kind === "video" || asset.mediaType.startsWith("video/");
}
