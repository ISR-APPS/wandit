import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import type {
	CustomerZone,
	CustomerZoneDnsRecord,
} from "../../application/fulfillment/domain-fulfillment.contracts";
import {
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";

const CLOUDFLARE_FETCH_TIMEOUT_MS = 10_000;
const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const AUTOMATIC_TTL = 1;

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export type CustomerZoneDnsRecordUpsert = "created" | "unchanged" | "updated";

/**
 * Cloudflare zones created in OUR account for purchased domains, so the apex
 * (`https://{domain}`) is served by Cloudflare for SaaS: the SaaS verifier on
 * the Free plan needs a real CNAME to the SaaS zone (no apex-proxying
 * entitlement), and a DNS-only apex CNAME inside a Cloudflare zone is the only
 * way to give it one. Registrar-side ANAME/URL forwarding never satisfies it.
 */
@Injectable()
export class CustomerZoneService {
	private readonly logger = new Logger(CustomerZoneService.name);

	/** Exact-name lookup so a retry or backfill adopts an existing zone. */
	async findZoneByName(name: string): Promise<CustomerZone | null> {
		const wanted = name.toLowerCase();
		const payload = await this.request(
			"GET",
			`/zones?name=${encodeURIComponent(wanted)}`,
		);
		const results = Array.isArray(payload.result) ? payload.result : [];
		const match = results.find(
			(result) =>
				this.isRecord(result) &&
				this.stringValue(result.name)?.toLowerCase() === wanted,
		);

		return this.isRecord(match) ? this.mapZone(match) : null;
	}

	async createZone(name: string): Promise<CustomerZone> {
		const accountId = this.requiredEnv(
			env.CLOUDFLARE_ACCOUNT_ID,
			"CLOUDFLARE_ACCOUNT_ID",
		);
		const payload = await this.request("POST", "/zones", {
			account: { id: accountId },
			name: name.toLowerCase(),
			type: "full",
		});

		return this.mapZone(this.resultRecord(payload));
	}

	/** "pending" until the registry delegates to the zone's nameservers. */
	async getZoneStatus(id: string): Promise<string> {
		const payload = await this.request(
			"GET",
			`/zones/${encodeURIComponent(id)}`,
		);

		return this.mapZone(this.resultRecord(payload)).status;
	}

	/**
	 * Asks Cloudflare to re-check the registry delegation now instead of on its
	 * own schedule. Free zones accept this about once an hour; callers treat a
	 * refusal as best-effort.
	 */
	async requestActivationCheck(id: string): Promise<void> {
		await this.request(
			"PUT",
			`/zones/${encodeURIComponent(id)}/activation_check`,
		);
	}

	/**
	 * One record per (type, name): finds it, then patches its content or
	 * creates it. DNS-only (`proxied: false`) and automatic TTL by default.
	 */
	async upsertDnsRecord(
		zoneId: string,
		record: CustomerZoneDnsRecord,
	): Promise<CustomerZoneDnsRecordUpsert> {
		const name = record.name.toLowerCase();
		const body = {
			content: record.content,
			name,
			proxied: record.proxied ?? false,
			ttl: record.ttl ?? AUTOMATIC_TTL,
			type: record.type,
		};
		const listed = await this.request(
			"GET",
			`/zones/${encodeURIComponent(zoneId)}/dns_records?type=${encodeURIComponent(record.type)}&name=${encodeURIComponent(name)}`,
		);
		const results = Array.isArray(listed.result) ? listed.result : [];
		const existing = results.find(
			(result) =>
				this.isRecord(result) &&
				this.stringValue(result.name)?.toLowerCase() === name &&
				this.stringValue(result.type)?.toUpperCase() === record.type,
		);

		if (!this.isRecord(existing)) {
			await this.request(
				"POST",
				`/zones/${encodeURIComponent(zoneId)}/dns_records`,
				body,
			);

			return "created";
		}

		const id = this.stringValue(existing.id);

		if (!id) {
			this.logger.error("Cloudflare DNS record response omitted id");
			throw new DomainProviderError("Cloudflare zone request failed");
		}

		if (
			this.sameContent(record.type, existing.content, body.content) &&
			(existing.proxied ?? false) === body.proxied
		) {
			return "unchanged";
		}

		await this.request(
			"PATCH",
			`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(id)}`,
			body,
		);

		return "updated";
	}

	/** Terminal-failure cleanup only; a missing zone counts as deleted. */
	async deleteZone(id: string): Promise<void> {
		await this.request("DELETE", `/zones/${encodeURIComponent(id)}`);
	}

	private async request(
		method: HttpMethod,
		path: string,
		body?: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const token = this.requiredEnv(
			env.CLOUDFLARE_API_TOKEN,
			"CLOUDFLARE_API_TOKEN",
		);
		const response = await this.fetchWithTimeout(
			`${CLOUDFLARE_API_BASE_URL}${path}`,
			{
				body: body ? JSON.stringify(body) : undefined,
				headers: {
					Authorization: `Bearer ${token}`,
					...(body ? { "Content-Type": "application/json" } : {}),
				},
				method,
			},
		);

		if (method === "DELETE" && response.status === 404) {
			return {};
		}

		const payload = await this.safeJson(response);

		if (!response.ok || !this.isRecord(payload) || payload.success === false) {
			this.logger.error(
				`Cloudflare zone ${method} ${path} failed with status ${response.status}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError("Cloudflare zone request failed");
		}

		return payload;
	}

	private mapZone(result: Record<string, unknown>): CustomerZone {
		const id = this.stringValue(result.id);

		if (!id) {
			this.logger.error("Cloudflare zone response omitted id");
			throw new DomainProviderError("Cloudflare zone request failed");
		}

		const nameServers = Array.isArray(result.name_servers)
			? result.name_servers.flatMap((value) => {
					const nameServer = this.stringValue(value);

					return nameServer ? [nameServer.toLowerCase()] : [];
				})
			: [];

		return {
			id,
			nameServers,
			status: this.stringValue(result.status) ?? "pending",
		};
	}

	private sameContent(
		type: CustomerZoneDnsRecord["type"],
		existing: unknown,
		wanted: string,
	): boolean {
		const current = this.stringValue(existing);

		if (current === null) {
			return false;
		}

		if (type === "TXT") {
			// Cloudflare returns TXT content wrapped in double quotes.
			return this.unquote(current) === this.unquote(wanted);
		}

		return (
			current.toLowerCase().replace(/\.$/, "") ===
			wanted.toLowerCase().replace(/\.$/, "")
		);
	}

	private unquote(value: string): string {
		return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
			? value.slice(1, -1)
			: value;
	}

	private resultRecord(payload: Record<string, unknown>) {
		return this.isRecord(payload.result) ? payload.result : {};
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
				this.logger.error("Cloudflare zone request timed out");
				throw new DomainProviderError("Cloudflare zone request failed");
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

	private stringValue(value: unknown) {
		return typeof value === "string" && value.length > 0 ? value : null;
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
