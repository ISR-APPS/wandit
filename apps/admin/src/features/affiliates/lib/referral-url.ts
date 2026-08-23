import { WEB_APP_ORIGIN } from "@/lib/web-origin";

export { WEB_APP_ORIGIN };

export function buildReferralUrl(landingPath: string, code: string): string {
	const trimmedPath = landingPath.trim();
	const normalizedPath = trimmedPath
		? trimmedPath.startsWith("/")
			? trimmedPath
			: `/${trimmedPath}`
		: "/";
	const hashIndex = normalizedPath.indexOf("#");
	const pathAndQuery =
		hashIndex === -1 ? normalizedPath : normalizedPath.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? "" : normalizedPath.slice(hashIndex);
	const separator = pathAndQuery.includes("?") ? "&" : "?";

	return `${WEB_APP_ORIGIN}${pathAndQuery}${separator}ref=${encodeURIComponent(code)}${fragment}`;
}
