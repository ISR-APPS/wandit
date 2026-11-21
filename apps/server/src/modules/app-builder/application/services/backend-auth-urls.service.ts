/**
 * Writes the login URLs of one V2 app into its Supabase auth config
 * (WANDIT-190): `site_url` and `uri_allow_list`. It also keeps the From name
 * of the sign-up code email equal to the project name. The
 * `sync-backend-auth-urls` task calls it after a publish, a custom domain
 * change, and a project rename. It reads the backend row, the live slug, the
 * active domains, and the project name, then calls the Management API. No
 * Nest decorator: the Trigger task composes it by hand.
 */
import {
	previewAuthRedirectPattern,
	type SupabaseAuthConfigResponse,
} from "@wandit/contracts";

import { canonicalDomainHost } from "../../../domains/domain/domain-hosts";
import type { DomainRow } from "../../../domains/infrastructure/persistence/domains.repository";
import {
	APP_AUTH_SMTP_HOST,
	appEmailSenderName,
	confirmationEmailHtml,
} from "../../domain/app-auth-email";
import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import type {
	BackendRef,
	SupabaseManagementClient,
} from "../../infrastructure/supabase/supabase-management.client";

/** The Management API calls of one sync. */
type AuthConfigClient = Pick<
	SupabaseManagementClient,
	"getAuthConfig" | "updateAuthUrls" | "updateAuthSenderName"
>;

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
	/** `projects.name`, or null when no project row exists. The From name of the code email follows it. */
	findProjectName: (projectId: string) => Promise<string | null>;
	/** Worker Management API client. Null without `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID`; every sync then skips. */
	client: AuthConfigClient | null;
	/** `env.SITES_DOMAIN`, the zone of the slug hosts, for example `wandit.app`. */
	sitesDomain: string;
	/** `env.PREVIEW_DOMAIN`, the zone of the preview run hosts; null when the worker has none. */
	previewDomain: string | null;
	logger: SandboxLogger;
};

/** What one sync did. `skipped` means the sync made no Management API call. */
export type BackendAuthUrlsSyncResult = "updated" | "unchanged" | "skipped";

/**
 * Rebuilds `site_url` and `uri_allow_list` from the published hosts of one
 * project, and the From name of the code email from the project name.
 */
export class BackendAuthUrlsService {
	constructor(private readonly deps: BackendAuthUrlsDeps) {}

	/**
	 * Syncs one project. A paused or failed backend skips: it gets its values
	 * at the next publish, domain change, or rename. A Management API error
	 * propagates. It never sends the SMTP password and never changes the
	 * sign-up mode.
	 */
	async sync(projectId: string): Promise<BackendAuthUrlsSyncResult> {
		const { client } = this.deps;
		const backend = await this.deps.backends.findByProjectId(projectId);
		// LIMIT: a rename during a pause keeps the old From name until the next publish or rename. Upgrade: start the sync after the wake.
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

		const scope = { projectId, ref: backend.ref };
		const current = await client.getAuthConfig(scope);
		// The URLs go first: a refused sender name must not stop a login redirect.
		const didUpdateUrls = await this.syncUrls(client, scope, current);
		const didUpdateSenderName = await this.syncSenderName(
			client,
			scope,
			current,
		);
		return didUpdateUrls || didUpdateSenderName ? "updated" : "unchanged";
	}

	// Answers true when it sent the two URL fields.
	private async syncUrls(
		client: AuthConfigClient,
		scope: BackendRef,
		current: SupabaseAuthConfigResponse,
	): Promise<boolean> {
		const { projectId } = scope;
		const { previewDomain } = this.deps;
		const hosts = await this.publishedHosts(projectId);
		// The first published host is the default redirect. An active custom
		// domain counts also before the first publish. With no host, the
		// preview apex stays, as provisioning set it.
		const siteHost = hosts[0] ?? previewDomain;
		if (siteHost === null) {
			this.deps.logger.info("backend-auth-urls.urls-skipped", {
				projectId,
				reason: "no-host",
			});
			return false;
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

		if (
			current.site_url === siteUrl &&
			isSameEntrySet(current.uri_allow_list, uriAllowList)
		) {
			return false;
		}
		await client.updateAuthUrls(scope, { siteUrl, uriAllowList });
		this.deps.logger.info("backend-auth-urls.updated", {
			entries: String(uriAllowList.length),
			projectId,
			siteUrl,
		});
		return true;
	}

	// Answers true when it sent a new From name. The email body shows the
	// name, so the body goes with it.
	private async syncSenderName(
		client: AuthConfigClient,
		scope: BackendRef,
		current: SupabaseAuthConfigResponse,
	): Promise<boolean> {
		// Product rule: only a backend that sends the code email through the
		// Wandit sender has a From name to keep. Any other backend stays as it is.
		if (current.smtp_host !== APP_AUTH_SMTP_HOST) {
			return false;
		}
		const projectName = await this.deps.findProjectName(scope.projectId);
		if (projectName === null) {
			return false;
		}
		const senderName = appEmailSenderName(projectName);
		// LIMIT: only the name is compared, so a new email body in code reaches a backend at its next rename. Upgrade: compare the body too.
		if (current.smtp_sender_name === senderName) {
			return false;
		}
		await client.updateAuthSenderName(scope, {
			confirmationHtml: confirmationEmailHtml(senderName),
			senderName,
		});
		this.deps.logger.info("backend-auth-urls.sender-name-updated", {
			projectId: scope.projectId,
		});
		return true;
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
