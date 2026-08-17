import { Injectable, Logger } from "@nestjs/common";
import type { Registrant } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import {
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";
import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
	DomainRegistrationOptions,
	DomainRegistrationResult,
} from "../../domain/ports/domain-provider.port";

const NAMECOM_BASE_URLS = {
	production: "https://api.name.com",
	sandbox: "https://api.dev.name.com",
} as const;

const DNS_TTL_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 15_000;

type NamecomEnvironment = keyof typeof NAMECOM_BASE_URLS;
type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type RequestOptions = {
	allowNotFound?: boolean;
	body?: Record<string, unknown>;
	idempotencyKey?: string;
};

type NamecomDnsRecord = {
	answer: string;
	host: string;
	id: number;
	ttl: number;
	type: string;
};

type NamecomUrlForwarding = {
	forwardsTo: string;
	host: string;
	id?: number;
	type: string;
};

/**
 * The only code in the domain feature that knows Name.com's HTTP contract.
 *
 * Application orchestration talks to DomainProvider instead. Registrar changes
 * stay inside this adapter and its composition roots.
 */
@Injectable()
export class NamecomProvider implements DomainProvider {
	private readonly logger = new Logger(NamecomProvider.name);

	/**
	 * Search is read-only. Results are correlated by name because Name.com says
	 * response order must not be relied on.
	 */
	async checkAvailability(names: string[]): Promise<DomainAvailability[]> {
		if (names.length === 0) {
			return [];
		}

		const payload = await this.request(
			"POST",
			"/core/v1/domains:checkAvailability",
			{
				body: {
					domainNames: names,
					// MVP supports ordinary registrations only—not aftermarket sales.
					purchaseType: "registration",
				},
			},
		);
		const results = this.arrayValue(this.recordValue(payload)?.results);
		const byName = new Map<string, Record<string, unknown>>();

		for (const value of results) {
			const result = this.recordValue(value);
			const domainName = this.stringValue(result?.domainName)?.toLowerCase();

			if (result && domainName) {
				byName.set(domainName, result);
			}
		}

		return names.map((name) => {
			const result = byName.get(name.toLowerCase());
			const purchaseType = this.stringValue(result?.purchaseType);
			const isRegistration = purchaseType === "registration";

			return {
				available: result?.purchasable === true && isRegistration,
				name,
				premium: result?.premium === true,
				renewalPriceUsd: this.numberValue(result?.renewalPrice) ?? undefined,
				wholesalePriceUsd: this.numberValue(result?.purchasePrice) ?? undefined,
			};
		});
	}

	/**
	 * Registration spends money from our Name.com account.
	 *
	 * The caller must supply a stable idempotency key. Name.com then returns the
	 * original result if a task retries after a timeout.
	 */
	async register(
		name: string,
		registrant: Registrant,
		options: DomainRegistrationOptions,
	): Promise<DomainRegistrationResult> {
		const contact = this.toNamecomContact(registrant);
		const payload = await this.request("POST", "/core/v1/domains", {
			body: {
				domain: {
					autorenewEnabled: false,
					contacts: {
						admin: contact,
						billing: contact,
						registrant: contact,
						tech: contact,
					},
					domainName: name,
					locked: true,
					privacyEnabled: options.privacy,
				},
				purchaseType: "registration",
				years: options.years,
			},
			idempotencyKey: options.idempotencyKey,
		});
		const response = this.recordValue(payload);
		const domain = this.recordValue(response?.domain);
		const registeredName = this.stringValue(domain?.domainName);
		const providerOrderId = this.orderId(response?.order);
		const totalPaidUsd = this.numberValue(response?.totalPaid);

		if (
			!registeredName ||
			registeredName.toLowerCase() !== name.toLowerCase()
		) {
			throw new DomainProviderError("Registrar domain create failed", {
				retryable: false,
			});
		}

		return {
			expiresAt: this.dateValue(domain?.expireDate),
			// Name.com addresses domains by their name rather than a separate id.
			providerDomainId: registeredName.toLowerCase(),
			...(providerOrderId ? { providerOrderId } : {}),
			...(totalPaidUsd === null ? {} : { totalPaidUsd }),
			transferLockExpiresAt: this.dateValue(domain?.transferLockExpiresAt),
		};
	}

	/**
	 * This method is ready for the future paid-renewal fulfillment job. No public
	 * route calls it until the payment module is connected.
	 */
	async renew(
		name: string,
		years: number,
	): Promise<{ expiresAt: Date | null }> {
		const payload = await this.request(
			"POST",
			`/core/v1/domains/${encodeURIComponent(name)}:renew`,
			{ body: { years } },
		);
		const domain = this.recordValue(this.recordValue(payload)?.domain);

		return { expiresAt: this.dateValue(domain?.expireDate) };
	}

	/**
	 * Name.com manages DNS one record at a time. We reconcile only records owned
	 * by Wandit and preserve unrelated records the customer may add later.
	 *
	 * An ANAME is the one exception: it can only coexist with other ANAME/CNAME
	 * data at its host, so any A/AAAA there (registrar URL-forwarding artifacts
	 * on purchased domains, whose DNS only Wandit manages) is deleted first.
	 */
	async setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void> {
		const existing = await this.listDnsRecords(name);

		for (const desired of records) {
			const host = this.relativeHost(name, desired.name);

			if (desired.type === "ANAME") {
				const conflicting = existing.filter(
					(record) =>
						record.host === host &&
						(record.type === "A" || record.type === "AAAA"),
				);

				for (const record of conflicting) {
					await this.deleteDnsRecord(name, record.id);
					existing.splice(existing.indexOf(record), 1);
				}
			}

			const exact = existing.find(
				(record) =>
					record.host === host &&
					record.type === desired.type &&
					record.answer === desired.value,
			);

			if (exact) {
				continue;
			}

			const replaceable =
				desired.type === "CNAME"
					? existing.find(
							(record) => record.host === host && record.type === desired.type,
						)
					: desired.type === "ANAME"
						? existing.find(
								(record) =>
									record.host === host &&
									(record.type === "ANAME" || record.type === "CNAME"),
							)
						: undefined;
			const body = {
				answer: desired.value,
				host,
				ttl: DNS_TTL_SECONDS,
				type: desired.type,
			};

			if (replaceable) {
				await this.request(
					"PUT",
					`/core/v1/domains/${encodeURIComponent(name)}/records/${replaceable.id}`,
					{ body },
				);
				continue;
			}

			await this.request(
				"POST",
				`/core/v1/domains/${encodeURIComponent(name)}/records`,
				{ body },
			);
		}
	}

	/**
	 * Purchased domains serve the apex through Cloudflare, so registrar URL
	 * forwarding (which has no TLS) must go. Deletes every apex entry; a no-op
	 * when none exist, so retries are safe.
	 */
	async clearUrlForwarding(name: string): Promise<void> {
		const entries = await this.listUrlForwardings(name);

		for (const entry of entries) {
			if (entry.host !== "" || entry.id === undefined) {
				continue;
			}

			await this.request(
				"DELETE",
				`/core/v1/urlforwarding/${encodeURIComponent(name)}/${entry.id}`,
			);
		}
	}

	/** Return the secret once; callers must never persist or log it. */
	async getAuthCode(name: string): Promise<string> {
		const payload = await this.request(
			"GET",
			`/core/v1/domains/${encodeURIComponent(name)}:getAuthCode`,
		);
		const authCode = this.stringValue(this.recordValue(payload)?.authCode);

		if (!authCode) {
			throw new DomainProviderError("Registrar auth code request failed", {
				retryable: false,
			});
		}

		return authCode;
	}

	/** Name.com uses one PATCH endpoint for lock, privacy, and autorenew state. */
	async setTransferLock(name: string, locked: boolean): Promise<void> {
		await this.request(
			"PATCH",
			`/core/v1/domains/${encodeURIComponent(name)}`,
			{ body: { locked } },
		);
	}

	/** A missing domain returns null so sync/retry code can make the decision. */
	async getDomainInfo(name: string): Promise<DomainProviderInfo | null> {
		const payload = await this.request(
			"GET",
			`/core/v1/domains/${encodeURIComponent(name)}`,
			{ allowNotFound: true },
		);

		if (payload === null) {
			return null;
		}

		const domain = this.recordValue(payload);
		const domainName = this.stringValue(domain?.domainName);

		if (!domainName) {
			throw new DomainProviderError("Registrar returned an invalid domain", {
				retryable: false,
			});
		}

		const expiresAt = this.dateValue(domain?.expireDate);

		return {
			expiresAt,
			id: domainName.toLowerCase(),
			isLocked: typeof domain?.locked === "boolean" ? domain.locked : undefined,
			status:
				expiresAt && expiresAt.getTime() <= Date.now() ? "expired" : "active",
			transferLockExpiresAt: this.dateValue(domain?.transferLockExpiresAt),
		};
	}

	private async listDnsRecords(name: string): Promise<NamecomDnsRecord[]> {
		const payload = await this.request(
			"GET",
			`/core/v1/domains/${encodeURIComponent(name)}/records?perPage=1000`,
		);
		const values = this.arrayValue(this.recordValue(payload)?.records);

		return values.flatMap((value) => {
			const record = this.recordValue(value);
			const id = this.numberValue(record?.id);
			const answer = this.stringValue(record?.answer);
			const type = this.stringValue(record?.type);

			if (id === null || answer === null || type === null) {
				return [];
			}

			return [
				{
					answer,
					host: this.normalizeHost(name, record?.host),
					id,
					ttl: this.numberValue(record?.ttl) ?? DNS_TTL_SECONDS,
					type,
				},
			];
		});
	}

	private async deleteDnsRecord(name: string, id: number): Promise<void> {
		await this.request(
			"DELETE",
			`/core/v1/domains/${encodeURIComponent(name)}/records/${id}`,
		);
	}

	private async listUrlForwardings(
		name: string,
	): Promise<NamecomUrlForwarding[]> {
		const payload = await this.request(
			"GET",
			`/core/v1/urlforwarding/${encodeURIComponent(name)}?perPage=1000`,
		);
		const response = this.recordValue(payload);
		const values = this.arrayValue(
			response?.urlForwarding ?? response?.urlForwardings,
		);

		return values.flatMap((value) => {
			const entry = this.recordValue(value);
			const forwardsTo = this.stringValue(entry?.forwardsTo);
			const type = this.stringValue(entry?.type);

			if (!entry || !forwardsTo || !type) {
				return [];
			}

			// Apex entries can arrive as "", "@", the full domain, or with no host
			// field at all depending on how they were created; normalize all to "".
			const host = this.normalizeHost(name, entry.host);
			const id = this.numberValue(entry?.id);

			return [
				{
					forwardsTo,
					host,
					...(id === null ? {} : { id }),
					type,
				},
			];
		});
	}

	private toNamecomContact(registrant: Registrant) {
		return {
			address1: registrant.address.street,
			city: registrant.address.city,
			...(registrant.companyName
				? { companyName: registrant.companyName }
				: {}),
			country: registrant.address.countryCode,
			email: registrant.email,
			firstName: registrant.firstName,
			lastName: registrant.lastName,
			phone: registrant.phone,
			state: registrant.address.wilaya,
			zip: registrant.address.zip,
		};
	}

	/** Hosts are bare labels; the apex may appear as "", "@", the full domain, or be absent. */
	private normalizeHost(domainName: string, host: unknown): string {
		if (typeof host !== "string" || host.length === 0) {
			return "";
		}

		return this.relativeHost(domainName, host);
	}

	private relativeHost(domainName: string, recordName: string): string {
		const normalized = recordName.trim().toLowerCase().replace(/\.$/, "");
		const domain = domainName.toLowerCase();

		if (normalized === "" || normalized === "@" || normalized === domain) {
			return "";
		}

		return normalized.endsWith(`.${domain}`)
			? normalized.slice(0, -(domain.length + 1))
			: normalized;
	}

	private async request(
		method: HttpMethod,
		path: string,
		options: RequestOptions = {},
	): Promise<unknown> {
		const config = this.configuration();
		let response: Response;

		try {
			response = await fetch(`${config.baseUrl}${path}`, {
				body: options.body ? JSON.stringify(options.body) : undefined,
				headers: {
					Authorization: `Basic ${Buffer.from(
						`${config.username}:${config.apiToken}`,
					).toString("base64")}`,
					...(options.body ? { "Content-Type": "application/json" } : {}),
					...(options.idempotencyKey
						? { "X-Idempotency-Key": options.idempotencyKey }
						: {}),
				},
				method,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			this.logger.error(
				`Name.com ${method} ${path} could not reach the registrar`,
				error instanceof Error ? error.message : String(error),
			);
			throw new DomainProviderError("Registrar request failed", {
				retryable: true,
			});
		}

		if (response.status === 404 && options.allowNotFound) {
			return null;
		}

		const payload = await this.safeJson(response);

		if (!response.ok) {
			this.logger.error(
				`Name.com ${method} ${path} failed with status ${response.status}`,
				JSON.stringify(this.safeErrorDetails(payload)),
			);
			throw new DomainProviderError("Registrar request failed", {
				retryable: this.isRetryableStatus(response.status),
				upstreamStatus: response.status,
			});
		}

		return payload;
	}

	private configuration(): {
		apiToken: string;
		baseUrl: string;
		username: string;
	} {
		const environment = this.environment();
		const username = this.requiredEnv(
			process.env.NAMECOM_USERNAME ?? env.NAMECOM_USERNAME,
			"NAMECOM_USERNAME",
		);
		const apiToken = this.requiredEnv(
			process.env.NAMECOM_API_TOKEN ?? env.NAMECOM_API_TOKEN,
			"NAMECOM_API_TOKEN",
		);

		// This catches the most common and most dangerous configuration mix-up.
		if (
			(environment === "sandbox" && !username.endsWith("-test")) ||
			(environment === "production" && username.endsWith("-test"))
		) {
			this.logger.error(
				`NAMECOM_USERNAME does not match NAMECOM_ENVIRONMENT=${environment}`,
			);
			throw new DomainsNotConfiguredError("NAMECOM_USERNAME");
		}

		return {
			apiToken,
			baseUrl: NAMECOM_BASE_URLS[environment],
			username,
		};
	}

	private environment(): NamecomEnvironment {
		const value = process.env.NAMECOM_ENVIRONMENT ?? env.NAMECOM_ENVIRONMENT;

		if (value === "sandbox" || value === "production") {
			return value;
		}

		throw new DomainsNotConfiguredError("NAMECOM_ENVIRONMENT");
	}

	private requiredEnv(value: string | undefined, name: string): string {
		if (!value) {
			this.logger.error(`Missing domains configuration value ${name}`);
			throw new DomainsNotConfiguredError(name);
		}

		return value;
	}

	private isRetryableStatus(status: number): boolean {
		return status === 429 || status === 500 || status === 502 || status === 504;
	}

	private safeErrorDetails(payload: unknown) {
		const record = this.recordValue(payload);

		return {
			details: this.stringValue(record?.details) ?? undefined,
			message: this.stringValue(record?.message) ?? undefined,
		};
	}

	private async safeJson(response: Response): Promise<unknown> {
		if (response.status === 204) {
			return null;
		}

		try {
			return await response.json();
		} catch {
			return null;
		}
	}

	private dateValue(value: unknown): Date | null {
		if (typeof value !== "string" && typeof value !== "number") {
			return null;
		}

		const date = new Date(value);

		return Number.isNaN(date.valueOf()) ? null : date;
	}

	private stringValue(value: unknown): string | null {
		return typeof value === "string" && value.length > 0 ? value : null;
	}

	private numberValue(value: unknown): number | null {
		return typeof value === "number" && Number.isFinite(value) ? value : null;
	}

	private orderId(value: unknown): string | null {
		if (typeof value === "string" && value.length > 0) {
			return value;
		}

		return typeof value === "number" && Number.isFinite(value)
			? String(value)
			: null;
	}

	private arrayValue(value: unknown): unknown[] {
		return Array.isArray(value) ? value : [];
	}

	private recordValue(value: unknown): Record<string, unknown> | null {
		return typeof value === "object" && value !== null
			? (value as Record<string, unknown>)
			: null;
	}
}
