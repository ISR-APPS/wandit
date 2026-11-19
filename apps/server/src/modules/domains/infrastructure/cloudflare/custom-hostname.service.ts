/**
 * Cloudflare custom hostnames of the wandit.app SaaS zone: find, create, read,
 * re-validate, and delete. DomainsService, the domain fulfillment steps, and
 * the Trigger runtimes call it. It calls the Cloudflare REST API with fetch.
 * On staging it refuses every write and skips every delete (see areCustomDomainsEnabled).
 */
import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import type {
	CustomHostnameRecord,
	CustomHostnameResult,
} from "../../application/fulfillment/domain-fulfillment.contracts";
import { canonicalDomainHost } from "../../domain/domain-hosts";
import {
	areCustomDomainsEnabled,
	assertCustomDomainsEnabled,
} from "../../domain/domain-provisioning-rules";
import {
	CustomHostnameMissingError,
	DomainProviderError,
	DomainsNotConfiguredError,
} from "../../domain/errors/domain.errors";

const CLOUDFLARE_FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class CustomHostnameService {
	private readonly logger = new Logger(CustomHostnameService.name);

	/**
	 * Returns the www custom hostname of `host`, and adopts one that exists.
	 * Cloudflare rejects a duplicate POST, so a hostname left by a detach or a
	 * deleted project would block every new attach of the name.
	 * Throws CustomDomainsProductionOnlyError on staging, before the lookup.
	 */
	async findOrCreateCustomHostname(
		host: string,
	): Promise<CustomHostnameResult> {
		// Security: staging shares the SaaS zone, so an adopted hostname can belong to a production customer.
		assertCustomDomainsEnabled();
		const hostname = canonicalDomainHost(host);
		const existing = await this.findCustomHostnameByName(hostname);

		if (existing?.status === "active") {
			return existing;
		}

		// Cloudflare can time out the validation of an old hostname. The PATCH starts it again.
		if (existing) {
			return this.refreshCustomHostnameValidation(existing.id);
		}

		return this.requestCustomHostname("POST", "", {
			hostname,
			ssl: {
				method: "http",
				type: "dv",
			},
		});
	}

	/**
	 * Purchased-domain apex: the bare name is registered as its own custom
	 * hostname so Cloudflare holds a certificate for `https://{domain}` and the
	 * edge can redirect it to www. Never canonicalized.
	 * Rejects with CustomDomainsProductionOnlyError on staging.
	 */
	async createApexCustomHostname(host: string): Promise<CustomHostnameResult> {
		assertCustomDomainsEnabled();
		return this.requestCustomHostname("POST", "", {
			hostname: host,
			ssl: {
				method: "http",
				type: "dv",
			},
		});
	}

	/** Throws CustomHostnameMissingError when Cloudflare deleted the hostname. */
	async getCustomHostnameStatus(id: string): Promise<CustomHostnameResult> {
		return this.requestCustomHostname("GET", `/${encodeURIComponent(id)}`);
	}

	/**
	 * Exact-name lookup so retries and backfills adopt an existing hostname
	 * instead of tripping Cloudflare's duplicate-hostname error.
	 */
	async findCustomHostnameByName(
		hostname: string,
	): Promise<CustomHostnameResult | null> {
		const payload = await this.requestCustomHostnamePayload(
			"GET",
			`?hostname=${encodeURIComponent(hostname)}`,
		);
		const results = Array.isArray(payload.result) ? payload.result : [];
		const wanted = hostname.toLowerCase();
		const match = results.find(
			(result) =>
				this.isRecord(result) &&
				this.stringValue(result.hostname)?.toLowerCase() === wanted,
		);

		return this.isRecord(match) ? this.mapCustomHostnameResult(match) : null;
	}

	/**
	 * Re-sends the same SSL settings; Cloudflare treats the PATCH as a request
	 * to re-run hostname and certificate validation immediately.
	 * Throws CustomHostnameMissingError when Cloudflare deleted the hostname.
	 * Rejects with CustomDomainsProductionOnlyError on staging.
	 */
	async refreshCustomHostnameValidation(
		id: string,
	): Promise<CustomHostnameResult> {
		assertCustomDomainsEnabled();
		return this.requestCustomHostname("PATCH", `/${encodeURIComponent(id)}`, {
			ssl: {
				method: "http",
				type: "dv",
			},
		});
	}

	/** A 404 counts as deleted. On staging it only logs a warning and makes no Cloudflare call. */
	async deleteCustomHostname(id: string): Promise<void> {
		// Security: on staging the hostname can belong to a production customer, so staging never deletes it.
		if (!areCustomDomainsEnabled()) {
			this.logger.warn(
				`Staging skips the Cloudflare delete of custom hostname ${id}: it can belong to production`,
			);
			return;
		}

		await this.requestCustomHostname("DELETE", `/${encodeURIComponent(id)}`);
	}

	private async requestCustomHostname(
		method: "DELETE" | "GET" | "PATCH" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<CustomHostnameResult> {
		const payload = await this.requestCustomHostnamePayload(method, path, body);

		if (method === "DELETE") {
			return {
				hostnameStatus: "deleted",
				id: "",
				requiredRecords: [],
				sslStatus: null,
				status: "deleted",
			};
		}

		return this.mapCustomHostnameResult(
			this.isRecord(payload.result) ? payload.result : {},
		);
	}

	private async requestCustomHostnamePayload(
		method: "DELETE" | "GET" | "PATCH" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const token = this.requiredEnv(
			env.CLOUDFLARE_API_TOKEN,
			"CLOUDFLARE_API_TOKEN",
		);
		const zoneId = this.requiredEnv(
			env.CLOUDFLARE_ZONE_ID_WANDIT_APP,
			"CLOUDFLARE_ZONE_ID_WANDIT_APP",
		);
		const response = await this.fetchWithTimeout(
			`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/custom_hostnames${path}`,
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

		// Only an id path names one hostname. Its 404 means Cloudflare deleted it.
		if (response.status === 404 && path.startsWith("/")) {
			throw new CustomHostnameMissingError();
		}

		const payload = await this.safeJson(response);

		if (!response.ok || !this.isRecord(payload) || payload.success === false) {
			this.logger.error(
				`Cloudflare custom-hostname ${method} failed with status ${response.status}`,
				JSON.stringify(payload),
			);
			throw new DomainProviderError(
				"Cloudflare custom hostname request failed",
			);
		}

		return payload;
	}

	private mapCustomHostnameResult(
		result: Record<string, unknown>,
	): CustomHostnameResult {
		const id = typeof result.id === "string" ? result.id : "";

		if (!id) {
			this.logger.error("Cloudflare custom-hostname response omitted id");
			throw new DomainProviderError(
				"Cloudflare custom hostname request failed",
			);
		}

		const statuses = this.statusFromResult(result);

		return {
			hostnameStatus: statuses.hostnameStatus,
			id,
			requiredRecords: this.extractRequiredRecords(result),
			sslStatus: statuses.sslStatus,
			status: statuses.status,
		};
	}

	private extractRequiredRecords(
		result: Record<string, unknown>,
	): CustomHostnameRecord[] {
		const records: CustomHostnameRecord[] = [];
		const ownershipVerification = this.isRecord(result.ownership_verification)
			? result.ownership_verification
			: null;

		if (ownershipVerification) {
			const name = this.stringValue(ownershipVerification.name);
			const value = this.stringValue(ownershipVerification.value);

			if (name && value) {
				records.push({ name, type: "TXT", value });
			}
		}

		const ssl = this.isRecord(result.ssl) ? result.ssl : null;
		const sslValidationRecords = Array.isArray(ssl?.validation_records)
			? ssl.validation_records
			: [];

		for (const record of sslValidationRecords) {
			if (!this.isRecord(record)) {
				continue;
			}

			const name = this.stringValue(record.txt_name ?? record.name);
			const value = this.stringValue(record.txt_value ?? record.value);

			if (name && value) {
				records.push({ name, type: "TXT", value });
			}
		}

		return records;
	}

	private statusFromResult(result: Record<string, unknown>) {
		const ssl = this.isRecord(result.ssl) ? result.ssl : null;
		const sslStatus = this.stringValue(ssl?.status);
		const hostnameStatus = this.stringValue(result.status);

		if (
			sslStatus === "active" &&
			(!hostnameStatus || hostnameStatus === "active")
		) {
			return { hostnameStatus, sslStatus, status: "active" };
		}

		return {
			hostnameStatus,
			sslStatus,
			status: sslStatus || hostnameStatus || "pending",
		};
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
				this.logger.error("Cloudflare custom-hostname request timed out");
				throw new DomainProviderError(
					"Cloudflare custom hostname request failed",
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

	private stringValue(value: unknown) {
		return typeof value === "string" && value.length > 0 ? value : null;
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}
}
