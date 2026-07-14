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
	DomainRegistrationResult,
} from "../../domain/ports/domain-provider.port";

type TokenState = {
	expiresAt: number;
	token: string;
};

@Injectable()
export class OpenproviderProvider implements DomainProvider {
	private readonly logger = new Logger(OpenproviderProvider.name);
	private tokenState: TokenState | null = null;

	checkAvailability(names: string[]): Promise<DomainAvailability[]> {
		return this.postAvailabilityCheck(names);
	}

	async register(
		name: string,
		registrant: Registrant,
		options: { privacy: boolean; years: number },
	): Promise<DomainRegistrationResult> {
		const customerHandle = await this.createCustomerHandle(registrant);
		const created = await this.createDomain(name, customerHandle, options);

		return {
			expiresAt: this.dateValue(created.expiresAt),
			providerDomainId: created.providerDomainId,
		};
	}

	async renew(name: string, years: number): Promise<{ expiresAt: Date | null }> {
		const info = await this.getDomainInfo(name);

		if (!info) {
			throw new DomainProviderError("Domain not found at registrar");
		}

		const renewed = await this.renewDomain(info.id, years);

		return {
			expiresAt: this.dateValue(renewed.expiresAt),
		};
	}

	async setDnsRecords(
		name: string,
		records: DomainDnsRecord[],
	): Promise<void> {
		await this.ensureDnsZone(name);
		await this.putDnsRecords(name, records);
	}

	async setUrlForwarding(name: string, target: string): Promise<void> {
		await this.putUrlForwarding(name, target);
	}

	async getAuthCode(name: string): Promise<string> {
		const info = await this.getDomainInfo(name);

		if (!info) {
			throw new DomainProviderError("Domain not found at registrar");
		}

		return this.fetchAuthCode(info.id);
	}

	async setTransferLock(name: string, locked: boolean): Promise<void> {
		const info = await this.getDomainInfo(name);

		if (!info) {
			throw new DomainProviderError("Domain not found at registrar");
		}

		await this.putTransferLock(info.id, locked);
	}

	async getDomainInfo(name: string): Promise<DomainProviderInfo | null> {
		return this.fetchDomainInfoByName(name);
	}

	private async postAvailabilityCheck(
		names: string[],
	): Promise<DomainAvailability[]> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): availability payload/price fields.
		const payload = await this.request("POST", "/v1beta/domains/check", {
			body: {
				domains: names.map((name) => ({ name })),
				with_price: true,
			},
		});
		const results = this.arrayValue(this.recordValue(payload)?.results);
		const byName = new Map<string, Record<string, unknown>>();

		for (const item of results) {
			const result = this.recordValue(item);
			const resultName = result ? this.domainNameFromResult(result) : null;

			if (result && resultName) {
				byName.set(resultName, result);
			}
		}

		return names.map((name, index) => {
			const result =
				byName.get(name.toLowerCase()) ?? this.recordValue(results[index]);
			const price = this.numberValue(
				result?.price ?? result?.price_usd ?? result?.wholesale_price,
			);

			return {
				available:
					this.booleanValue(result?.is_available) ??
					this.booleanValue(result?.available) ??
					false,
				name,
				premium:
					this.booleanValue(result?.is_premium) ??
					this.booleanValue(result?.premium) ??
					false,
				wholesalePriceUsd: price ?? undefined,
			};
		});
	}

	private domainNameFromResult(result: Record<string, unknown>): string | null {
		const direct = this.stringValue(
			result.domain_name ?? result.domainName ?? result.name,
		);

		if (direct) {
			return direct.toLowerCase();
		}

		if (typeof result.domain === "string" && result.domain.length > 0) {
			return result.domain.toLowerCase();
		}

		const domain = this.recordValue(result.domain);
		const sld = this.stringValue(domain?.name ?? domain?.sld);
		const extension = this.stringValue(
			domain?.extension ?? domain?.tld ?? domain?.suffix,
		);

		return sld && extension ? `${sld}.${extension}`.toLowerCase() : null;
	}

	private async createCustomerHandle(
		registrant: Registrant,
	): Promise<string> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): customer create payload and handle field.
		const payload = await this.request("POST", "/v1beta/customers", {
			body: {
				address: {
					city: registrant.address.city,
					country: registrant.address.countryCode,
					number: "",
					street: registrant.address.street,
					zipcode: registrant.address.zip,
				},
				company_name: registrant.companyName,
				email: registrant.email,
				name: {
					first_name: registrant.firstName,
					full_name: `${registrant.firstName} ${registrant.lastName}`,
					last_name: registrant.lastName,
				},
				phone: registrant.phone,
			},
		});
		const result = this.recordValue(payload);
		const handle = this.stringValue(
			result?.handle ?? result?.customer_handle ?? result?.id,
		);

		if (!handle) {
			throw new DomainProviderError("Registrar customer create failed");
		}

		return handle;
	}

	private async createDomain(
		name: string,
		customerHandle: string,
		options: { privacy: boolean; years: number },
	): Promise<{ expiresAt: unknown; providerDomainId: string }> {
		const [sld, extension] = name.split(".");

		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): domain create owner/privacy fields.
		const payload = await this.request("POST", "/v1beta/domains", {
			body: {
				admin_handle: customerHandle,
				billing_handle: customerHandle,
				domain: {
					extension,
					name: sld,
				},
				owner_handle: customerHandle,
				period: options.years,
				privacy: options.privacy,
				tech_handle: customerHandle,
			},
		});
		const result = this.recordValue(payload);
		const providerDomainId = this.stringValue(result?.id ?? result?.domain_id);

		if (!providerDomainId) {
			throw new DomainProviderError("Registrar domain create failed");
		}

		return {
			expiresAt: result?.expiration_date ?? result?.expires_at,
			providerDomainId,
		};
	}

	private async renewDomain(
		providerDomainId: string,
		years: number,
	): Promise<{ expiresAt: unknown }> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): renew endpoint and period field.
		const payload = await this.request(
			"POST",
			`/v1beta/domains/${encodeURIComponent(providerDomainId)}/renew`,
			{
				body: { period: years },
			},
		);
		const result = this.recordValue(payload);

		return {
			expiresAt: result?.expiration_date ?? result?.expires_at,
		};
	}

	private async ensureDnsZone(name: string): Promise<void> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): DNS zone create idempotency.
		await this.request("POST", "/v1beta/dns/zones", {
			body: {
				name,
			},
		});
	}

	private async putDnsRecords(
		name: string,
		records: DomainDnsRecord[],
	): Promise<void> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): DNS record replace payload shape.
		await this.request(
			"PUT",
			`/v1beta/dns/zones/${encodeURIComponent(name)}/records`,
			{
				body: {
					records: records.map((record) => ({
						name: record.name,
						type: record.type,
						value: record.value,
					})),
				},
			},
		);
	}

	private async putUrlForwarding(name: string, target: string): Promise<void> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): URL forwarding endpoint for apex redirect.
		await this.request(
			"PUT",
			`/v1beta/domains/${encodeURIComponent(name)}/forwarding`,
			{
				body: {
					target,
					type: "redirect",
				},
			},
		);
	}

	private async fetchAuthCode(providerDomainId: string): Promise<string> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): auth-code endpoint path/field.
		const payload = await this.request(
			"GET",
			`/v1beta/domains/${encodeURIComponent(providerDomainId)}/authcode`,
		);
		const result = this.recordValue(payload);
		const authCode = this.stringValue(
			result?.auth_code ?? result?.authcode ?? result?.code,
		);

		if (!authCode) {
			throw new DomainProviderError("Registrar auth code request failed");
		}

		return authCode;
	}

	private async putTransferLock(
		providerDomainId: string,
		locked: boolean,
	): Promise<void> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): transfer-lock update field.
		await this.request(
			"PUT",
			`/v1beta/domains/${encodeURIComponent(providerDomainId)}`,
			{
				body: {
					is_locked: locked,
				},
			},
		);
	}

	private async fetchDomainInfoByName(
		name: string,
	): Promise<DomainProviderInfo | null> {
		// VERIFY against Openprovider docs in sandbox (ISRECOM-42): domain lookup by name query fields.
		const payload = await this.request(
			"GET",
			`/v1beta/domains/${encodeURIComponent(name)}`,
			{
				allowNotFound: true,
			},
		);

		if (payload === null) {
			return null;
		}

		const result = this.recordValue(payload);
		const id = this.stringValue(result?.id ?? result?.domain_id);

		if (!id) {
			return null;
		}

		return {
			expiresAt: this.dateValue(result?.expiration_date ?? result?.expires_at),
			id,
			isLocked:
				this.booleanValue(result?.is_locked) ??
				this.booleanValue(result?.isLocked) ??
				undefined,
			status: this.stringValue(result?.status) ?? undefined,
		};
	}

	private async request(
		method: "GET" | "POST" | "PUT",
		path: string,
		options: {
			allowNotFound?: boolean;
			body?: Record<string, unknown>;
			retry?: boolean;
		} = {},
	): Promise<unknown> {
		const response = await this.fetchWithToken(method, path, options.body);

		if (response.status === 401 && options.retry !== false) {
			this.tokenState = null;

			return this.request(method, path, {
				...options,
				retry: false,
			});
		}

		if (response.status === 404 && options.allowNotFound) {
			return null;
		}

		const payload = await this.safeJson(response);

		if (!response.ok) {
			this.logger.error(
				`Openprovider ${method} ${path} failed with status ${response.status}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError("Registrar request failed");
		}

		this.assertSuccessfulEnvelope(method, path, payload);

		return this.unwrapResult(payload);
	}

	private async fetchWithToken(
		method: "GET" | "POST" | "PUT",
		path: string,
		body?: Record<string, unknown>,
	) {
		const token = await this.getToken();

		return fetch(`${this.baseUrl()}${path}`, {
			body: body ? JSON.stringify(body) : undefined,
			headers: {
				Authorization: `Bearer ${token}`,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			method,
		});
	}

	private async getToken(): Promise<string> {
		if (this.tokenState && this.tokenState.expiresAt > Date.now() + 30_000) {
			return this.tokenState.token;
		}

		const username = this.requiredEnv(
			env.OPENPROVIDER_USERNAME,
			"OPENPROVIDER_USERNAME",
		);
		const password = this.requiredEnv(
			env.OPENPROVIDER_PASSWORD,
			"OPENPROVIDER_PASSWORD",
		);
		const response = await fetch(`${this.baseUrl()}/v1beta/auth/login`, {
			body: JSON.stringify({ password, username }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const payload = await this.safeJson(response);

		if (!response.ok) {
			this.logger.error(
				`Openprovider login failed with status ${response.status}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError("Registrar authentication failed");
		}

		this.assertSuccessfulEnvelope("POST", "/v1beta/auth/login", payload);

		const result = this.recordValue(this.unwrapResult(payload));
		const token = this.stringValue(result?.token ?? result?.access_token);

		if (!token) {
			throw new DomainProviderError("Registrar authentication failed");
		}

		const expiresIn = this.numberValue(result?.expires_in) ?? 900;
		this.tokenState = {
			expiresAt: Date.now() + Math.max(expiresIn - 30, 60) * 1000,
			token,
		};

		return token;
	}

	private baseUrl() {
		const apiUrl = this.requiredEnv(
			env.OPENPROVIDER_API_URL,
			"OPENPROVIDER_API_URL",
		);

		return apiUrl.replace(/\/+$/, "");
	}

	private requiredEnv(value: string | undefined, name: string) {
		if (!value) {
			this.logger.error(`Missing domains configuration value ${name}`);
			throw new DomainsNotConfiguredError(name);
		}

		return value;
	}

	private assertSuccessfulEnvelope(
		method: string,
		path: string,
		payload: unknown,
	): void {
		const record = this.recordValue(payload);
		const code = this.numberValue(record?.code);

		if (typeof code === "number" && code !== 0) {
			this.logger.error(
				`Openprovider ${method} ${path} returned error code ${code}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError("Registrar request failed");
		}
	}

	private unwrapResult(payload: unknown) {
		const record = this.recordValue(payload);

		return record && "data" in record
			? record.data
			: record && "result" in record
				? record.result
				: payload;
	}

	private async safeJson(response: Response): Promise<unknown> {
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

	private booleanValue(value: unknown): boolean | null {
		return typeof value === "boolean" ? value : null;
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
