import { Inject, Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import { canonicalDomainHost } from "../../domain/domain-hosts";
import {
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";
import { DomainsRepository } from "../persistence/domains.repository";

const CLOUDFLARE_FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class DomainRoutingService {
	private readonly logger = new Logger(DomainRoutingService.name);
	private accountId: string | null = null;

	constructor(
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
	) {}

	/**
	 * Raw-host pointer writer for hosts that are already complete hostnames
	 * (e.g. `{slug}.wandit.app` written by publishing). No canonicalization.
	 */
	putHostPointer(
		host: string,
		pointer: Record<string, unknown>,
	): Promise<void> {
		return this.writeKvValue(`domain:${host}`, pointer);
	}

	deleteHostPointer(host: string): Promise<void> {
		return this.deleteKvValue(`domain:${host}`);
	}

	putDomainPointer(
		host: string,
		pointer: Record<string, unknown>,
	): Promise<void> {
		return this.putHostPointer(canonicalDomainHost(host), pointer);
	}

	deleteDomainPointer(host: string): Promise<void> {
		return this.deleteHostPointer(canonicalDomainHost(host));
	}

	/**
	 * Re-point every active custom domain of a project. Currently uncalled by
	 * design: published bytes live at an R2 key derived from projectId alone
	 * (published/{projectId}/current.html), so `domain:{host}` pointers are
	 * version-free ({projectId, source}) and never need a per-publish refresh.
	 * Only reach for this if the pointer shape ever grows per-publish data —
	 * and prefer not to let it.
	 */
	async refreshProjectDomains(
		projectId: string,
		pointer: Record<string, unknown>,
	): Promise<void> {
		const rows = await this.domainsRepository.findActiveByProject(projectId);

		await Promise.all(
			rows.map((row) => this.putDomainPointer(row.name, pointer)),
		);
	}

	/**
	 * True when the Cloudflare KV credentials exist. Publishing degrades to
	 * log-and-skip when they are absent (mirrors the isR2Configured contract)
	 * so local dev without Cloudflare still publishes.
	 */
	isKvConfigured(): boolean {
		return Boolean(
			env.CLOUDFLARE_API_TOKEN &&
				env.CLOUDFLARE_KV_NAMESPACE_ID &&
				env.CLOUDFLARE_ZONE_ID_WANDIT_APP,
		);
	}

	private async writeKvValue(
		key: string,
		pointer: Record<string, unknown>,
	): Promise<void> {
		await this.kvFetch(`/values/${encodeURIComponent(key)}`, {
			body: JSON.stringify(pointer),
			headers: { "Content-Type": "application/json" },
			method: "PUT",
		});
	}

	private async deleteKvValue(key: string): Promise<void> {
		await this.kvFetch(`/values/${encodeURIComponent(key)}`, {
			method: "DELETE",
		});
	}

	private async kvFetch(path: string, init: RequestInit): Promise<void> {
		const token = this.requiredEnv(
			env.CLOUDFLARE_API_TOKEN,
			"CLOUDFLARE_API_TOKEN",
		);
		const namespaceId = this.requiredEnv(
			env.CLOUDFLARE_KV_NAMESPACE_ID,
			"CLOUDFLARE_KV_NAMESPACE_ID",
		);
		const accountId = await this.resolveAccountId(token);
		const response = await this.fetchWithTimeout(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}${path}`,
			{
				...init,
				headers: {
					Authorization: `Bearer ${token}`,
					...(init.headers ?? {}),
				},
			},
		);

		if (init.method === "DELETE" && response.status === 404) {
			return;
		}

		if (!response.ok) {
			const payload = await this.safeText(response);
			this.logger.error(
				`Cloudflare KV request failed with status ${response.status}`,
				payload,
			);
			throw new DomainProviderError("Cloudflare domain routing request failed");
		}
	}

	private async resolveAccountId(token: string): Promise<string> {
		if (this.accountId) {
			return this.accountId;
		}

		const zoneId = this.requiredEnv(
			env.CLOUDFLARE_ZONE_ID_WANDIT_APP,
			"CLOUDFLARE_ZONE_ID_WANDIT_APP",
		);
		const response = await this.fetchWithTimeout(
			`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}`,
			{
				headers: { Authorization: `Bearer ${token}` },
				method: "GET",
			},
		);
		const payload = await this.safeJson(response);

		if (!response.ok || !this.isRecord(payload) || payload.success === false) {
			this.logger.error(
				`Cloudflare zone lookup failed with status ${response.status}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError("Cloudflare domain routing request failed");
		}

		const result = this.isRecord(payload.result) ? payload.result : null;
		const account = this.isRecord(result?.account) ? result.account : null;
		const accountId = typeof account?.id === "string" ? account.id : null;

		if (!accountId) {
			this.logger.error("Cloudflare zone lookup did not return account id");
			throw new DomainProviderError("Cloudflare domain routing request failed");
		}

		this.accountId = accountId;

		return accountId;
	}

	private requiredEnv(value: string | undefined, name: string) {
		if (!value) {
			this.logger.error(`Missing domains configuration value ${name}`);
			throw new DomainsNotConfiguredError(name);
		}

		return value;
	}

	private async fetchWithTimeout(
		url: string,
		init: RequestInit,
	): Promise<Response> {
		try {
			return await fetch(url, {
				...init,
				signal: AbortSignal.timeout(CLOUDFLARE_FETCH_TIMEOUT_MS),
			});
		} catch (error) {
			if (this.isAbortError(error)) {
				this.logger.error("Cloudflare domain routing request timed out");
				throw new DomainProviderError(
					"Cloudflare domain routing request failed",
				);
			}

			throw error;
		}
	}

	private isAbortError(error: unknown): boolean {
		return error instanceof DOMException && error.name === "TimeoutError";
	}

	private async safeJson(response: Response): Promise<unknown> {
		try {
			return await response.json();
		} catch {
			return null;
		}
	}

	private async safeText(response: Response): Promise<string> {
		try {
			return await response.text();
		} catch {
			return "";
		}
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
