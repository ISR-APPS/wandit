/**
 * Builds the egress policy of a V2 sandbox: deny-by-default with an allow
 * list. `VercelSandboxProvider.start` calls `buildNetworkPolicy` before the
 * vendor call, and a live `setNetworkPolicy` reuses the same shapes. The
 * file holds only domain data — vendor types stay in the provider.
 */
import type { SandboxNetworkPolicy } from "../../domain/ports/sandbox-provider";

/**
 * CIDRs a sandbox can never reach: the link-local metadata endpoint,
 * private ranges, CGNAT, and loopback. `metadata.google.internal` is a
 * host name, not an IP: the allow list itself denies it.
 * LIMIT: the vendor API accepts IPv4 CIDRs only — every IPv6 form answers
 * 400 (probed 2026-09). Upgrade: add fd00:ec2::/32, fd20:ce::/32, and
 * ::1/128 when the API takes IPv6.
 */
export const SANDBOX_DENIED_RANGES = [
	"169.254.0.0/16",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"100.64.0.0/10",
	"127.0.0.0/8",
] as const;

/**
 * Hosts every sandbox may reach, independent of the project.
 * `registry.npmjs.org`: `pnpm install` at template init and inside turns.
 * `*.supabase.co`: the generated app's backend database and auth.
 * `fonts.googleapis.com`, `fonts.gstatic.com`: fonts the template loads.
 * `api.stripe.com`, `api.resend.com`, `maps.googleapis.com`,
 * `api.openai.com`: the connectors a generated app can wire up.
 */
export const GLOBAL_ALLOWED_HOSTS = [
	"registry.npmjs.org",
	"*.supabase.co",
	"fonts.googleapis.com",
	"fonts.gstatic.com",
	"api.stripe.com",
	"api.resend.com",
	"maps.googleapis.com",
	"api.openai.com",
] as const;

/**
 * `strict` denies every host outside the allow list. `open` allows every
 * host but keeps the deny ranges; it is the fallback when the allow list
 * breaks a turn.
 */
export type SandboxEgressMode = "strict" | "open";

/** One DNS label: alphanumerics and inner dashes only. */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * True when `host` is a lower-case DNS name the vendor policy accepts.
 * Callers lower-case first: an upper-case letter returns false. At least
 * two labels, at most 253 chars, no scheme, path, port, `@`, or trailing
 * dot, and no IPv4 or IPv6 literal. A wildcard is allowed only as the whole
 * first label (`*.supabase.co`).
 */
export function isValidNetworkHost(host: string): boolean {
	// RFC 1035 caps a host name at 253 chars.
	if (host.length === 0 || host.length > 253) {
		return false;
	}
	if (host !== host.toLowerCase()) {
		return false;
	}
	if (host.endsWith(".")) {
		return false;
	}
	const labels = host.split(".");
	const firstIsWildcard = labels[0] === "*";
	// A star anywhere else — `a.*.b`, `*.*.com` — is never valid.
	if (labels.slice(firstIsWildcard ? 1 : 0).includes("*")) {
		return false;
	}
	const nameLabels = firstIsWildcard ? labels.slice(1) : labels;
	// `*.com` or `*.co` would open a whole TLD; a wildcard needs at least
	// two labels after it.
	if (firstIsWildcard && nameLabels.length < 2) {
		return false;
	}
	// A single label like `localhost` or `metadata` is never a public host.
	if (nameLabels.length < 2) {
		return false;
	}
	const tld = nameLabels[nameLabels.length - 1] ?? "";
	// A letters-only TLD of 2+ chars rejects IPv4 literals (numeric last
	// label) and one-letter endings.
	if (!/^[a-z]{2,}$/.test(tld)) {
		return false;
	}
	return nameLabels.every((label) => DNS_LABEL.test(label));
}

/**
 * Merges the global list, the LLM proxy host, the git host, the asset host,
 * and the valid caller hosts into one deduped, sorted allow list. Throws
 * when the proxy URL is missing or bad — a sandbox with no reachable proxy
 * must not start — and when a configured git or asset host is invalid.
 * `rejected` keeps the caller hosts that fail validation, spelled as given.
 */
export function buildNetworkPolicy(input: {
	mode: SandboxEgressMode;
	proxyBaseUrl: string;
	gitHost: string | null;
	assetHost: string | null;
	projectHosts: string[];
	connectorHosts: string[];
}): { policy: SandboxNetworkPolicy; rejected: string[] } {
	const deniedRanges = [...SANDBOX_DENIED_RANGES];
	if (input.mode === "open") {
		return { policy: { allowedHosts: ["*"], deniedRanges }, rejected: [] };
	}

	if (!URL.canParse(input.proxyBaseUrl)) {
		throw new Error(
			`Sandbox egress: proxyBaseUrl "${input.proxyBaseUrl}" is not a URL`,
		);
	}
	const proxyHost = new URL(input.proxyBaseUrl).hostname;
	if (!isValidNetworkHost(proxyHost)) {
		throw new Error(
			`Sandbox egress: proxy host "${proxyHost}" is not a valid network host`,
		);
	}
	for (const [name, host] of [
		["gitHost", input.gitHost],
		["assetHost", input.assetHost],
	] as const) {
		if (host !== null && !isValidNetworkHost(host)) {
			throw new Error(
				`Sandbox egress: ${name} "${host}" is not a valid network host`,
			);
		}
	}

	const hosts = new Set<string>([...GLOBAL_ALLOWED_HOSTS, proxyHost]);
	if (input.gitHost !== null) {
		hosts.add(input.gitHost);
	}
	if (input.assetHost !== null) {
		hosts.add(input.assetHost);
	}
	const rejected: string[] = [];
	// LIMIT: callers pass empty lists in round 1. Upgrade: the
	// projects.networkAllowedHosts column and the connector registry feed
	// projectHosts, and WANDIT-189 feeds connectorHosts.
	for (const host of [...input.projectHosts, ...input.connectorHosts]) {
		const trimmed = host.trim();
		// The check sees the given case: an upper-case letter rejects, so a
		// typo lands in `rejected` instead of a silent fix.
		if (isValidNetworkHost(trimmed)) {
			hosts.add(trimmed);
		} else {
			rejected.push(host);
		}
	}
	return {
		policy: { allowedHosts: [...hosts].sort(), deniedRanges },
		rejected,
	};
}
