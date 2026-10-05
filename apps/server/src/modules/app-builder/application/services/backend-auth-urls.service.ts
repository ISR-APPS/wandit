/**
 * Writes the login URLs of one V2 app into its Supabase auth config
 * (WANDIT-190): `site_url` and `uri_allow_list`. The `sync-backend-auth-urls`
 * task calls it after a publish and after a custom domain change. It reads
 * the backend row, the live slug, and the active domains, then calls the
 * Management API. No Nest decorator: the Trigger task composes it by hand.
 */
import { previewAuthRedirectPattern } from "@wandit/contracts";

import { canonicalDomainHost } from "../../../domains/domain/domain-hosts";
import type { DomainRow } from "../../../domains/infrastructure/persistence/domains.repository";
import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import type { SupabaseManagementClient } from "../../infrastructure/supabase/supabase-management.client";

/** Dependencies of `BackendAuthUrlsService`; the Trigger task composes them. */
export type BackendAuthUrlsDeps = {
	/** Reads the `app_backends` row. Only an `active` row with a ref gets a sync. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** Slug of the active app deployment, or null when the app is not live. */
	findLiveSlug: (projectId: string) => Promise<string | null>;
	/** `DomainsRepository`: the custom domains of the project with status `active`. */
	domains: {
		findActiveByProject(
			projectId: string,
		): Promise<Pick<DomainRow, "name" | "isPrimary">[]>;
	};
	/** Worker Management API client. Null without `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`; every sync then skips. */
	client: Pick<
		SupabaseManagementClient,
		"getAuthConfig" | "updateAuthUrls"
	> | null;
	/** `env.SITES_DOMAIN`, the zone of the slug hosts, for example `wandit.app`. */
	sitesDomain: string;
	/** `env.PREVIEW_DOMAIN`, the zone of the preview run hosts; null when the worker has none. */
	previewDomain: string | null;
	logger: SandboxLogger;
};

/** What one sync did. `skipped` means the sync made no Management API call. */
export type BackendAuthUrlsSyncResult = "updated" | "unchanged" | "skipped";

/** Rebuilds `site_url` and `uri_allow_list` from the published hosts of one project. */
export class BackendAuthUrlsService {
	constructor(private readonly deps: BackendAuthUrlsDeps) {}

	/**
	 * Syncs one project. A paused or failed backend skips: it gets its URLs
	 * at the next publish or domain change. A Management API error propagates.
	 */
	async sync(projectId: string): Promise<BackendAuthUrlsSyncResult> {
		const { client, previewDomain } = this.deps;
		const backend = await this.deps.backends.findByProjectId(projectId);
		if (
			client === null ||
			backend === null ||
			backend.ref === null ||
			backend.status !== "active"
		) {
			this.deps.logger.info("backend-auth-urls.skipped", {
				projectId,
				reason:
					client === null ? "no-client" : (backend?.status ?? "no-backend"),
			});
			return "skipped";
		}

		const hosts = await this.publishedHosts(projectId);
		// The first published host is the default redirect. An active custom
		// domain counts also before the first publish. With no host, the
		// preview apex stays, as provisioning set it.
		const siteHost = hosts[0] ?? previewDomain;
		if (siteHost === null) {
			this.deps.logger.info("backend-auth-urls.skipped", {
				projectId,
				reason: "no-host",
			});
			return "skipped";
		}
		const siteUrl = `https://${siteHost}`;
		// Rebuilt from the known hosts at each sync, so a detached domain leaves
		// the list and can no longer receive a login redirect.
		const uriAllowList = [
			...(previewDomain === null
				? []
				: [previewAuthRedirectPattern(projectId, previewDomain)]),
			...hosts.map((host) => `https://${host}/**`),
		];

		const scope = { projectId, ref: backend.ref };
		const current = await client.getAuthConfig(scope);
		if (
			current.site_url === siteUrl &&
			isSameEntrySet(current.uri_allow_list, uriAllowList)
		) {
			return "unchanged";
		}
		await client.updateAuthUrls(scope, { siteUrl, uriAllowList });
		this.deps.logger.info("backend-auth-urls.updated", {
			entries: String(uriAllowList.length),
			projectId,
			siteUrl,
		});
		return "updated";
	}

	// The custom domains first, the primary one at the head, then the slug
	// host. Each custom domain gives its `www` host. The edge redirects the
	// apex to `www`, so the app runs on `www` only.
	private async publishedHosts(projectId: string): Promise<string[]> {
		const [domains, slug] = await Promise.all([
			this.deps.domains.findActiveByProject(projectId),
			this.deps.findLiveSlug(projectId),
		]);
		const primaryFirst = [
			...domains.filter((domain) => domain.isPrimary),
			...domains.filter((domain) => !domain.isPrimary),
		];
		const hosts = primaryFirst.map((domain) =>
			canonicalDomainHost(domain.name),
		);
		if (slug !== null) {
			hosts.push(`${slug}.${this.deps.sitesDomain}`);
		}
		// `example.com` and `www.example.com` give the same host.
		return [...new Set(hosts)];
	}
}

// The stored list is one comma-separated string; the order does not matter.
function isSameEntrySet(stored: string | null, wanted: string[]): boolean {
	const storedEntries = new Set(
		(stored ?? "")
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry !== ""),
	);
	const wantedEntries = new Set(wanted);
	return (
		storedEntries.size === wantedEntries.size &&
		[...wantedEntries].every((entry) => storedEntries.has(entry))
	);
}
