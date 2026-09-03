import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import type {
	CustomerZone,
	CustomerZoneDnsRecord,
	CustomerZoneDnsRecordDeletion,
	CustomerZoneDnsScan,
} from "../../application/fulfillment/domain-fulfillment.contracts";
import {
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";

const CLOUDFLARE_FETCH_TIMEOUT_MS = 10_000;
/**
 * The record scan resolves the domain's public DNS server-side and can take
 * well over the shared budget for a large or slowly served domain; a
 * client-side abort would not stop the import, only hide its outcome.
 */
const CLOUDFLARE_SCAN_TIMEOUT_MS = 60_000;
const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const AUTOMATIC_TTL = 1;
const DNS_RECORDS_PAGE_SIZE = 100;
/** Hard stop for the list paging loop; no customer zone comes near it. */
const DNS_RECORDS_MAX_PAGES = 100;
/** The only record types Cloudflare can proxy (orange-cloud). */
const PROXIABLE_RECORD_TYPES = new Set(["A", "AAAA", "CNAME"]);

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type RequestOptions = {
	/** A 404 resolves to `null` instead of a provider error. */
	missingAsNull?: boolean;
	timeoutMs?: number;
};

type ListedDnsRecord = {
	content: string | null;
	id: string;
	name: string;
	proxied: boolean;
	type: string;
};

export type CustomerZoneDnsRecordUpsert = "created" | "unchanged" | "updated";

/**
 * Cloudflare zones created in OUR account for purchased and external
 * domains, so the apex (`https://{domain}`) is served by Cloudflare for SaaS:
 * the SaaS verifier on the Free plan needs a real CNAME to the SaaS zone (no
 * apex-proxying entitlement), and a DNS-only apex CNAME inside a Cloudflare
 * zone is the only way to give it one. Registrar-side ANAME/URL forwarding
 * never satisfies it. The zone is pure DNS hosting: every record stays
 * DNS-only (grey-cloud); the site itself is proxied by the SaaS fallback origin.
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

	/**
	 * "pending" until the registry delegates to the zone's nameservers; `null`
	 * when the zone no longer exists (deleted out of band or purged by
	 * Cloudflare), so callers can withdraw the nameservers they exposed for it.
	 */
	async getZoneStatus(id: string): Promise<string | null> {
		const payload = await this.send(
			"GET",
			`/zones/${encodeURIComponent(id)}`,
			undefined,
			{ missingAsNull: true },
		);

		return payload === null
			? null
			: this.mapZone(this.resultRecord(payload)).status;
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

	/**
	 * Cloudflare's one-shot import of the domain's CURRENT public DNS records
	 * (mail, subdomains, ...) into the zone, so an external domain keeps working
	 * after its owner delegates to us. Conflicts with records that already exist
	 * surface as `messages`, not errors. Callers run it once, before our own
	 * records are written and before the user can have switched nameservers
	 * (afterwards it would read our own zone).
	 */
	async scanDnsRecords(zoneId: string): Promise<CustomerZoneDnsScan> {
		const payload = await this.request(
			"POST",
			`/zones/${encodeURIComponent(zoneId)}/dns_records/scan`,
			undefined,
			{ timeoutMs: CLOUDFLARE_SCAN_TIMEOUT_MS },
		);
		const result = this.resultRecord(payload);

		return {
			recordsAdded: this.countValue(result.recs_added),
			recordsParsed: this.countValue(result.total_records_parsed),
		};
	}

	/**
	 * Turns every proxied A/AAAA/CNAME record of the zone DNS-only. The scan
	 * imports web-looking records as proxied; our zone only hosts DNS, so a
	 * proxied record would route the customer's other hosts through Cloudflare
	 * without any origin configuration. Returns the number of records patched.
	 */
	async disableProxyOnAllRecords(zoneId: string): Promise<number> {
		let patched = 0;

		for (const record of await this.listDnsRecords(zoneId)) {
			if (!record.proxied || !PROXIABLE_RECORD_TYPES.has(record.type)) {
				continue;
			}

			await this.request(
				"PATCH",
				`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(record.id)}`,
				{ proxied: false },
			);
			patched += 1;
		}

		return patched;
	}

	/**
	 * Deletes the records of the given types at one exact name, except a
	 * record whose content equals `keepContent`, so our traffic CNAME can be
	 * created there (Cloudflare refuses a CNAME next to an A/AAAA/CNAME, error
	 * 81053). Returns the number of records deleted; a missing record counts as
	 * deleted.
	 */
	async deleteDnsRecords(
		zoneId: string,
		input: CustomerZoneDnsRecordDeletion,
	): Promise<number> {
		const name = input.name.toLowerCase();
		const types = new Set<string>(input.types);
		let deleted = 0;

		for (const record of await this.listDnsRecords(zoneId, name)) {
			if (record.name !== name || !types.has(record.type)) {
				continue;
			}

			if (
				input.keepContent !== undefined &&
				record.content !== null &&
				this.sameContent("CNAME", record.content, input.keepContent)
			) {
				continue;
			}

			await this.request(
				"DELETE",
				`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(record.id)}`,
			);
			deleted += 1;
		}

		return deleted;
	}

	/** Terminal-failure cleanup only; a missing zone counts as deleted. */
	async deleteZone(id: string): Promise<void> {
		await this.request("DELETE", `/zones/${encodeURIComponent(id)}`);
	}

	/** Every record of the zone (or of one exact name), following pagination. */
	private async listDnsRecords(
		zoneId: string,
		name?: string,
	): Promise<ListedDnsRecord[]> {
		const records: ListedDnsRecord[] = [];
		const filter = name ? `&name=${encodeURIComponent(name)}` : "";

		for (let page = 1; page <= DNS_RECORDS_MAX_PAGES; page += 1) {
			const payload = await this.request(
				"GET",
				`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=${DNS_RECORDS_PAGE_SIZE}&page=${page}${filter}`,
			);
			const results = Array.isArray(payload.result) ? payload.result : [];

			for (const result of results) {
				const record = this.mapDnsRecord(result);

				if (record) {
					records.push(record);
				}
			}

			const info = this.isRecord(payload.result_info)
				? payload.result_info
				: null;
			const totalPages =
				typeof info?.total_pages === "number" ? info.total_pages : null;

			if (
				results.length < DNS_RECORDS_PAGE_SIZE ||
				(totalPages !== null && page >= totalPages)
			) {
				break;
			}
		}

		return records;
	}

	private mapDnsRecord(value: unknown): ListedDnsRecord | null {
		if (!this.isRecord(value)) {
			return null;
		}

		const id = this.stringValue(value.id);
		const name = this.stringValue(value.name);
		const type = this.stringValue(value.type);

		if (!id || !name || !type) {
			return null;
		}

		return {
			content: this.stringValue(value.content),
			id,
			name: name.toLowerCase(),
			proxied: value.proxied === true,
			type: type.toUpperCase(),
		};
	}

	private async request(
		method: HttpMethod,
		path: string,
		body?: Record<string, unknown>,
		options: RequestOptions = {},
	): Promise<Record<string, unknown>> {
		return (await this.send(method, path, body, options)) ?? {};
	}

	/**
	 * One Cloudflare call. Resolves to `null` only for a 404 on a DELETE (the
	 * resource is gone, which is what the caller wanted) or when the caller
	 * opted into `missingAsNull`; every other failure is a provider error.
	 */
	private async send(
		method: HttpMethod,
		path: string,
		body: Record<string, unknown> | undefined,
		options: RequestOptions,
	): Promise<Record<string, unknown> | null> {
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
			options.timeoutMs ?? CLOUDFLARE_FETCH_TIMEOUT_MS,
		);

		if (
			response.status === 404 &&
			(method === "DELETE" || options.missingAsNull === true)
		) {
			return null;
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

	private countValue(value: unknown): number {
		return typeof value === "number" && Number.isFinite(value) && value >= 0
			? Math.floor(value)
			: 0;
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
		timeoutMs: number,
	): Promise<Response> {
		try {
			return await fetch(url, {
				...init,
				signal: AbortSignal.timeout(timeoutMs),
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
