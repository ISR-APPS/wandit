import { Resolver } from "node:dns/promises";
import { Injectable } from "@nestjs/common";

const DNS_QUERY_TIMEOUT_MS = 3_000;
const DNS_RESOLVER_TIMEOUT_MS = 2_500;
const DNS_RESOLVER_TRIES = 1;
const RDAP_QUERY_TIMEOUT_MS = 5_000;

export type DomainRegistrationCheckResult =
	| { status: "inconclusive"; reason: string }
	| { status: "registered" }
	| { status: "unregistered" };

class DnsQueryTimeoutError extends Error {}

@Injectable()
export class DomainRegistrationCheckService {
	async check(name: string): Promise<DomainRegistrationCheckResult> {
		const resolver = new Resolver({
			timeout: DNS_RESOLVER_TIMEOUT_MS,
			tries: DNS_RESOLVER_TRIES,
		});
		let nameservers: PromiseSettledResult<string[]>;
		let soa: PromiseSettledResult<
			Awaited<ReturnType<typeof resolver.resolveSoa>>
		>;

		try {
			[nameservers, soa] = await this.withTimeout(
				Promise.allSettled([
					resolver.resolveNs(name),
					resolver.resolveSoa(name),
				]),
				() => resolver.cancel(),
			);
		} catch (error) {
			if (!(error instanceof DnsQueryTimeoutError)) {
				throw error;
			}

			return {
				reason: "DNS registration lookup was inconclusive",
				status: "inconclusive",
			};
		}

		if (
			(nameservers.status === "fulfilled" && nameservers.value.length > 0) ||
			soa.status === "fulfilled"
		) {
			return { status: "registered" };
		}

		if (
			nameservers.status === "rejected" &&
			soa.status === "rejected" &&
			this.isNxDomainError(nameservers.reason) &&
			this.isNxDomainError(soa.reason)
		) {
			return this.confirmWithRdap(name);
		}

		return {
			reason: "DNS registration lookup was inconclusive",
			status: "inconclusive",
		};
	}

	private async confirmWithRdap(
		name: string,
	): Promise<DomainRegistrationCheckResult> {
		try {
			const response = await fetch(
				`https://rdap.org/domain/${encodeURIComponent(name)}`,
				{ signal: AbortSignal.timeout(RDAP_QUERY_TIMEOUT_MS) },
			);

			if (response.status === 200) {
				return { status: "registered" };
			}

			if (response.status === 404) {
				if (this.isRdapBootstrapNotFound(response)) {
					return {
						reason: "RDAP has no authoritative service for this TLD",
						status: "inconclusive",
					};
				}

				return { status: "unregistered" };
			}

			return {
				reason: `RDAP registration lookup returned HTTP ${response.status}`,
				status: "inconclusive",
			};
		} catch (error) {
			return {
				reason: `RDAP registration lookup failed: ${this.errorMessage(error)}`,
				status: "inconclusive",
			};
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private isNxDomainError(error: unknown): boolean {
		if (typeof error !== "object" || error === null || !("code" in error)) {
			return false;
		}

		const code = String(error.code).toUpperCase();

		return code === "ENOTFOUND" || code === "NXDOMAIN";
	}

	private isRdapBootstrapNotFound(response: Response): boolean {
		if (response.redirected || !response.url) {
			return false;
		}

		try {
			return new URL(response.url).hostname.toLowerCase() === "rdap.org";
		} catch {
			return false;
		}
	}

	private async withTimeout<T>(
		query: Promise<T>,
		onTimeout: () => void,
	): Promise<T> {
		let timeout: ReturnType<typeof setTimeout> | undefined;

		try {
			return await Promise.race([
				query,
				new Promise<T>((_resolve, reject) => {
					timeout = setTimeout(() => {
						onTimeout();
						reject(new DnsQueryTimeoutError());
					}, DNS_QUERY_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
	}
}
