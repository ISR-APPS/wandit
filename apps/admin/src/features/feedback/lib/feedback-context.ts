import type {
	AdminFeedbackActivity,
	AdminFeedbackSummary,
} from "@wandit/contracts";

import { titleCaseFeedbackValue } from "@/features/feedback/lib/feedback";

export type FeedbackActivityLabel = {
	label: string;
	description: string;
	tone: "default" | "accent" | "success";
};

function browserFromUserAgent(userAgent: string): string {
	const edgeVersion = userAgent.match(/\bEdg\/(\d+)/)?.[1];
	if (edgeVersion) {
		return `Edge ${edgeVersion}`;
	}

	const chromeVersion = userAgent.includes("Edg/")
		? undefined
		: userAgent.match(/\bChrome\/(\d+)/)?.[1];
	if (chromeVersion) {
		return `Chrome ${chromeVersion}`;
	}

	const firefoxVersion = userAgent.match(/\bFirefox\/(\d+)/)?.[1];
	if (firefoxVersion) {
		return `Firefox ${firefoxVersion}`;
	}

	const safariVersion = userAgent.match(
		/\bVersion\/(\d+)(?:\.\d+)*.*\bSafari\//,
	)?.[1];
	if (safariVersion) {
		return `Safari ${safariVersion}`;
	}

	return "Unknown browser";
}

function dottedVersion(value: string): string {
	return value.replaceAll("_", ".");
}

function deviceFromUserAgent(userAgent: string): string {
	if (userAgent.includes("Windows NT 10.0")) {
		return "Windows 10/11";
	}

	if (/\b(?:iPhone|iPad)\b/.test(userAgent)) {
		const iosVersion = userAgent.match(/\bOS (\d+(?:_\d+)*)/)?.[1];
		return iosVersion ? `iOS ${dottedVersion(iosVersion)}` : "Unknown device";
	}

	if (userAgent.includes("Android")) {
		const androidVersion = userAgent.match(/\bAndroid (\d+(?:\.\d+)*)/)?.[1];
		return androidVersion ? `Android ${androidVersion}` : "Unknown device";
	}

	const macOsVersion = userAgent.match(/\bMac OS X (\d+(?:[._]\d+)+)/)?.[1];
	if (macOsVersion) {
		return `macOS ${dottedVersion(macOsVersion)}`;
	}

	if (userAgent.includes("Linux")) {
		return "Linux";
	}

	return "Unknown device";
}

export function parseUserAgent(userAgent: string | null): {
	browser: string;
	device: string;
} {
	if (userAgent === null) {
		return { browser: "Unknown", device: "Unknown" };
	}

	return {
		browser: browserFromUserAgent(userAgent),
		device: deviceFromUserAgent(userAgent),
	};
}

export function safeHttpUrl(value: string | null): string | null {
	if (value === null) {
		return null;
	}

	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.href
			: null;
	} catch {
		return null;
	}
}

function isPathOrChild(pathname: string, path: string): boolean {
	return pathname === path || pathname.startsWith(`${path}/`);
}

export function pageLabelFromUrl(pageUrl: string): string {
	let pathname: string;

	try {
		pathname = new URL(pageUrl).pathname;
	} catch {
		return pageUrl;
	}

	const normalizedPathname =
		pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

	if (normalizedPathname.startsWith("/p/")) {
		return "Workspace";
	}

	if (normalizedPathname === "/dashboard") {
		return "Dashboard";
	}

	if (isPathOrChild(normalizedPathname, "/academy")) {
		return "Academy";
	}

	if (normalizedPathname === "/pricing") {
		return "Pricing";
	}

	if (normalizedPathname === "/onboarding") {
		return "Onboarding";
	}

	if (normalizedPathname === "/apps") {
		return "Apps";
	}

	if (normalizedPathname === "/affiliates") {
		return "Affiliates";
	}

	if (isPathOrChild(normalizedPathname, "/workspace")) {
		return "Workspace settings";
	}

	if (normalizedPathname === "/") {
		return "Home";
	}

	return pathname;
}

export function formatViewport(
	viewport: { width: number; height: number } | null,
): string | null {
	return viewport ? `${viewport.width} × ${viewport.height}` : null;
}

function activityValue(value: string | null): string {
	return value === null ? "Unknown" : titleCaseFeedbackValue(value);
}

export function activityLabel(
	activity: AdminFeedbackActivity,
	item: {
		context: Pick<AdminFeedbackSummary["context"], "pageUrl">;
	},
): FeedbackActivityLabel {
	const actorName = activity.actor?.name ?? "A team member";

	switch (activity.kind) {
		case "received":
			return {
				label: "Feedback received",
				description: `Submitted from ${pageLabelFromUrl(item.context.pageUrl)}`,
				tone: "accent",
			};
		case "status_changed":
			return {
				label:
					activity.toValue === "resolved"
						? "Marked resolved"
						: `Moved to ${activityValue(activity.toValue)}`,
				description: `${actorName} changed the status from ${activityValue(activity.fromValue)} to ${activityValue(activity.toValue)}`,
				tone: activity.toValue === "resolved" ? "success" : "default",
			};
		case "priority_changed":
			return {
				label: "Priority changed",
				description: `${actorName} changed the priority from ${activityValue(activity.fromValue)} to ${activityValue(activity.toValue)}`,
				tone: "default",
			};
		case "note_updated":
			return {
				label: "Internal note updated",
				description: `${actorName} edited the internal note`,
				tone: "default",
			};
	}
}
