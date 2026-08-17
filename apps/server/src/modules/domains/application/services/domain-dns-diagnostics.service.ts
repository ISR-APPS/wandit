import {
	resolve4,
	resolve6,
	resolveCname,
	resolveTxt,
} from "node:dns/promises";
import { Inject, Injectable } from "@nestjs/common";
import {
	type DnsRecordDiagnostic,
	type DnsRecordDiagnosticStatus,
	domainDnsSchema,
	type GetDomainDnsStatusResponse,
	type RequiredDomainRecord,
} from "@wandit/contracts";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { mapDomain } from "../../infrastructure/mappers/domain.mapper";
import { DomainsRepository } from "../../infrastructure/persistence/domains.repository";

const DNS_QUERY_TIMEOUT_MS = 3_000;
const MAX_OBSERVED_VALUES = 20;
const MAX_OBSERVED_VALUE_LENGTH = 256;

type DnsLookupResult =
	// "found"/"mismatch" come from lookups that already compared against the
	// expected value (ANAME); "resolved" leaves that comparison to the caller.
	| { status: "found" | "mismatch" | "missing" | "unknown"; values: string[] }
	| { status: "resolved"; values: string[] };

type ResolvableRecordType = Exclude<RequiredDomainRecord["type"], "ANAME">;

class DnsQueryTimeoutError extends Error {}

@Injectable()
export class DomainDnsDiagnosticsService {
	constructor(
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
	) {}

	async getStatus(
		id: string,
		scope: ProjectScope,
	): Promise<GetDomainDnsStatusResponse> {
		const row = await this.domainsRepository.getByIdForScope(id, scope);
		const dns = domainDnsSchema.safeParse(row.dns);
		// attachExternal persists the same required-record array it returns to the
		// client. Reading that array keeps diagnostics aligned with provisioning as
		// validation records and traffic targets evolve.
		const requiredRecords = dns.success ? (dns.data.records ?? []) : [];
		const lookups = new Map<string, Promise<DnsLookupResult>>();
		const records = await Promise.all(
			requiredRecords.map(async (record) => {
				const hostname = this.recordHostname(row.name, record.name);
				const key =
					record.type === "ANAME"
						? `ANAME:${hostname}:${record.value}`
						: `${record.type}:${hostname}`;
				const lookup = lookups.get(key) ?? this.lookupRecord(record, hostname);
				lookups.set(key, lookup);

				return this.diagnosticFor(record, await lookup);
			}),
		);

		return {
			checkedAt: new Date().toISOString(),
			domain: mapDomain(row),
			records,
		};
	}

	private async lookupRecord(
		record: Pick<RequiredDomainRecord, "type" | "value">,
		hostname: string,
	): Promise<DnsLookupResult> {
		if (record.type === "ANAME") {
			return this.lookupAname(hostname, record.value);
		}

		const type: ResolvableRecordType = record.type;

		try {
			const values = await this.withTimeout(this.resolve(type, hostname));

			return values.length > 0
				? { status: "resolved", values }
				: { status: "missing", values: [] };
		} catch (error) {
			if (type === "CNAME" && this.isDnsError(error, "ENODATA")) {
				return this.lookupFlattenedCname(hostname);
			}

			return this.isMissingDnsError(error)
				? { status: "missing", values: [] }
				: { status: "unknown", values: [] };
		}
	}

	/**
	 * An ANAME is invisible to resolvers: the apex answers with the target's A/AAAA
	 * addresses. It is satisfied when the apex answers are a non-empty subset of
	 * the target's current answers. An unresolvable target cannot be judged.
	 */
	private async lookupAname(
		hostname: string,
		target: string,
	): Promise<DnsLookupResult> {
		const [observed, expected] = await Promise.all([
			this.lookupAddresses(hostname),
			this.lookupAddresses(this.withoutTrailingDot(target.trim())),
		]);

		if (observed.status !== "resolved") {
			return observed;
		}

		if (expected.status !== "resolved") {
			return { status: "unknown", values: observed.values };
		}

		const expectedAddresses = new Set(
			expected.values.map((value) => value.toLowerCase()),
		);

		return {
			status: observed.values.every((value) =>
				expectedAddresses.has(value.toLowerCase()),
			)
				? "found"
				: "mismatch",
			values: observed.values,
		};
	}

	private async lookupFlattenedCname(
		hostname: string,
	): Promise<DnsLookupResult> {
		const addresses = await this.lookupAddresses(hostname);

		// Flattened answers cannot prove which CNAME target produced them.
		return addresses.status === "resolved"
			? { status: "unknown", values: addresses.values }
			: addresses;
	}

	private async lookupAddresses(hostname: string): Promise<DnsLookupResult> {
		const results = await Promise.allSettled([
			this.withTimeout(resolve4(hostname)),
			this.withTimeout(resolve6(hostname)),
		]);
		const values = results.flatMap((result) =>
			result.status === "fulfilled" ? result.value : [],
		);

		if (values.length > 0) {
			return { status: "resolved", values };
		}

		if (results.some((result) => result.status === "fulfilled")) {
			return { status: "missing", values: [] };
		}

		return results.every(
			(result) =>
				result.status === "rejected" && this.isMissingDnsError(result.reason),
		)
			? { status: "missing", values: [] }
			: { status: "unknown", values: [] };
	}

	private async resolve(
		type: ResolvableRecordType,
		hostname: string,
	): Promise<string[]> {
		switch (type) {
			case "A":
				return resolve4(hostname);
			case "AAAA":
				return resolve6(hostname);
			case "CNAME":
				return resolveCname(hostname);
			case "TXT":
				return (await resolveTxt(hostname)).map((chunks) => chunks.join(""));
		}
	}

	private diagnosticFor(
		record: RequiredDomainRecord,
		lookup: DnsLookupResult,
	): DnsRecordDiagnostic {
		const status: DnsRecordDiagnosticStatus =
			lookup.status === "resolved"
				? lookup.values.some(
						(value) =>
							this.comparableValue(record.type, value) ===
							this.comparableValue(record.type, record.value),
					)
					? "found"
					: "mismatch"
				: lookup.status;

		return {
			...record,
			observedValues: lookup.values
				.slice(0, MAX_OBSERVED_VALUES)
				.map((value) => this.truncateObservedValue(value)),
			status,
		};
	}

	private recordHostname(domainName: string, recordName: string): string {
		const apex = this.withoutTrailingDot(domainName).toLowerCase();
		const name = this.withoutTrailingDot(recordName.trim()).toLowerCase();

		if (name === "@" || name === apex) {
			return apex;
		}

		if (name.endsWith(`.${apex}`)) {
			return name;
		}

		return `${name}.${apex}`;
	}

	private comparableValue(
		type: RequiredDomainRecord["type"],
		value: string,
	): string {
		if (type === "CNAME") {
			return this.withoutTrailingDot(value.trim()).toLowerCase();
		}

		return value;
	}

	private withoutTrailingDot(value: string): string {
		return value.endsWith(".") ? value.slice(0, -1) : value;
	}

	private truncateObservedValue(value: string): string {
		if (value.length <= MAX_OBSERVED_VALUE_LENGTH) {
			return value;
		}

		return `${value.slice(0, MAX_OBSERVED_VALUE_LENGTH - 3)}...`;
	}

	private isMissingDnsError(error: unknown): boolean {
		return this.isDnsError(error, "ENOTFOUND");
	}

	private isDnsError(error: unknown, code: string): boolean {
		if (typeof error !== "object" || error === null || !("code" in error)) {
			return false;
		}

		return String(error.code).toUpperCase() === code;
	}

	private async withTimeout<T>(query: Promise<T>): Promise<T> {
		let timeout: ReturnType<typeof setTimeout> | undefined;

		try {
			return await Promise.race([
				query,
				new Promise<T>((_resolve, reject) => {
					timeout = setTimeout(
						() => reject(new DnsQueryTimeoutError()),
						DNS_QUERY_TIMEOUT_MS,
					);
				}),
			]);
		} finally {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
	}
}
