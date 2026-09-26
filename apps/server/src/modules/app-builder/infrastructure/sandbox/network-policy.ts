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
 * `fonts.googleapis.com`, `fonts.gstatic.com`: fonts the template loads.
 * `api.stripe.com`, `api.resend.com`, `maps.googleapis.com`,
 * `api.openai.com`: the connectors a generated app can wire up.
 * No `*.supabase.co` (WANDIT-283): it also reaches a Supabase project of an
 * attacker. `buildNetworkPolicy` adds only the project's own backend host.
 */
export const GLOBAL_ALLOWED_HOSTS = [
	"registry.npmjs.org",
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
 * first label (`*.example.com`).
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
 * True for `supabase.co`, `supabase.com`, and every name under them, a
 * wildcard too. Each one accepts a key of any Supabase account, so it can
 * receive stolen data. Only the exact backend host of the project may pass
 * (WANDIT-283). Callers lower-case first.
 */
export function isSupabaseHost(host: string): boolean {
	return ["supabase.co", "supabase.com"].some(
		(domain) => host === domain || host.endsWith(`.${domain}`),
	);
}

/**
 * Merges the global list and the proxy, git, asset, backend, and caller
 * hosts into one deduped, sorted allow list. It throws when the proxy URL is
 * missing or bad: a sandbox without a proxy must not start. It also throws
 * when a git, asset, or backend host is invalid. `rejected` keeps each
 * refused caller host, spelled as given.
 */
export function buildNetworkPolicy(input: {
	mode: SandboxEgressMode;
	proxyBaseUrl: string;
	gitHost: string | null;
	assetHost: string | null;
	/**
	 * Host of the project's own Supabase project, `<ref>.supabase.co`, from
	 * `VITE_SUPABASE_URL`. Null while the project has no active backend.
	 */
	backendHost: string | null;
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
		["backendHost", input.backendHost],
	] as const) {
		if (host !== null && !isValidNetworkHost(host)) {
			throw new Error(
				`Sandbox egress: ${name} "${host}" is not a valid network host`,
			);
		}
	}
	// Security: a wildcard backend host opens every Supabase project, also a
	// project of an attacker. The backend is always one exact host.
	if (input.backendHost?.startsWith("*.")) {
		throw new Error(
			`Sandbox egress: backendHost "${input.backendHost}" must not be a wildcard`,
		);
	}

	const hosts = new Set<string>([...GLOBAL_ALLOWED_HOSTS, proxyHost]);
	if (input.gitHost !== null) {
		hosts.add(input.gitHost);
	}
	if (input.assetHost !== null) {
		hosts.add(input.assetHost);
	}
	// LIMIT: the Vercel firewall matches the TLS SNI only. Sandbox code can
	// send this SNI with the Host header of another project. The shared
	// Supabase edge can then route it there (domain fronting). Upgrade: a
	// Host-pin request transform through the harness session; `createSession`
	// in `claude-code.harness.ts` clears the provider transforms today.
	if (input.backendHost !== null) {
		hosts.add(input.backendHost);
	}
	const rejected: string[] = [];
	// LIMIT: callers pass empty lists in round 1. Upgrade: the
	// projects.networkAllowedHosts column and the connector registry feed
	// projectHosts, and WANDIT-189 feeds connectorHosts.
	for (const host of [...input.projectHosts, ...input.connectorHosts]) {
		const trimmed = host.trim();
		// The check sees the given case: an upper-case letter rejects, so a
		// typo lands in `rejected` instead of a silent fix. Security: a stored
		// Supabase host other than the backend host reopens WANDIT-283.
		if (
			isValidNetworkHost(trimmed) &&
			(!isSupabaseHost(trimmed) || trimmed === input.backendHost)
		) {
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
