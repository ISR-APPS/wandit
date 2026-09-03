import { resolveNs } from "node:dns/promises";
import { domainDnsSchema } from "@wandit/contracts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DNS_QUERY_TIMEOUT_MS = 3_000;
const REMINDER_MARK_MAX_ATTEMPTS = 3;
const REMINDER_MARK_RETRY_DELAY_MS = 50;

export const EXTERNAL_DELEGATION_REMINDER_AGE_DAYS = 14;
export const EXTERNAL_DELEGATION_REMINDER_BATCH_SIZE = 100;

export type ExternalDomainDelegationReminderCandidate = {
	createdAt: Date;
	dns: unknown;
	externalDelegationReminderSentAt: Date | null;
	id: string;
	name: string;
	projectId: string | null;
	source: string;
	userId: string;
};

export interface ExternalDomainDelegationReminderStore {
	findExternalDelegationReminderCandidates(input: {
		after?: { createdAt: Date; id: string };
		createdBefore: Date;
		limit: number;
	}): Promise<readonly ExternalDomainDelegationReminderCandidate[]>;
	findOwnerEmail(userId: string): Promise<string | null>;
	markExternalDelegationReminderSent(id: string): Promise<boolean>;
	mergeDnsIfStatus(
		id: string,
		statuses: ("active" | "configuring")[],
		patch: Record<string, unknown>,
	): Promise<unknown | null>;
}

export interface ExternalDomainDelegationReminderEmailSender {
	sendExternalDomainDelegationReminder(input: {
		dashboardUrl: string;
		domainId: string;
		domainName: string;
		idempotencyKey: string;
		nameServers: readonly string[];
		to: string;
	}): Promise<void>;
}

export interface ExternalDomainDelegationReminderZoneStatusReader {
	getZoneStatus(id: string): Promise<string | null>;
}

export interface ExternalDomainDelegationReminderLogger {
	warn(message: string, context?: string): void;
}

export type ExternalDomainDelegationRemindersOptions = {
	batchSize?: number;
	dashboardOrigin: string;
	logger: ExternalDomainDelegationReminderLogger;
	resolveNameservers?: (name: string) => Promise<readonly string[]>;
};

export type ExternalDomainDelegationRemindersResult = {
	failed: number;
	processed: true;
	reminded: number;
};

type DelegationStatus = "delegated" | "inconclusive" | "mismatch";

export class ExternalDomainDelegationRemindersService {
	private readonly batchSize: number;
	private readonly resolveNameservers: (
		name: string,
	) => Promise<readonly string[]>;

	constructor(
		private readonly domains: ExternalDomainDelegationReminderStore,
		private readonly email: ExternalDomainDelegationReminderEmailSender,
		private readonly customerZones: ExternalDomainDelegationReminderZoneStatusReader,
		private readonly options: ExternalDomainDelegationRemindersOptions,
	) {
		this.batchSize = Math.max(
			1,
			Math.min(
				Math.floor(
					options.batchSize ?? EXTERNAL_DELEGATION_REMINDER_BATCH_SIZE,
				),
				EXTERNAL_DELEGATION_REMINDER_BATCH_SIZE,
			),
		);
		this.resolveNameservers = options.resolveNameservers ?? resolveNs;
	}

	async execute(
		now = new Date(),
	): Promise<ExternalDomainDelegationRemindersResult> {
		const createdBefore = new Date(
			now.getTime() - EXTERNAL_DELEGATION_REMINDER_AGE_DAYS * DAY_MS,
		);
		let failed = 0;
		let reminded = 0;
		let after: { createdAt: Date; id: string } | undefined;
		const postSendMarkErrors: unknown[] = [];

		while (true) {
			const candidates =
				await this.domains.findExternalDelegationReminderCandidates({
					...(after ? { after } : {}),
					createdBefore,
					limit: this.batchSize,
				});

			if (candidates.length === 0) {
				break;
			}

			for (const candidate of candidates) {
				try {
					const dns = domainDnsSchema.safeParse(candidate.dns);

					if (
						!dns.success ||
						!this.isEligible(candidate, dns.data, createdBefore)
					) {
						continue;
					}

					const nameServers = this.usableNameservers(dns.data.zoneNameServers);

					if (
						!dns.data.zoneId ||
						dns.data.zoneActive === true ||
						nameServers.length === 0
					) {
						continue;
					}

					let zoneStatus: string | null;

					try {
						zoneStatus = await this.customerZones.getZoneStatus(
							dns.data.zoneId,
						);
					} catch (error) {
						this.options.logger.warn(
							`External domain delegation reminder zone lookup failed for ${candidate.id}`,
							error instanceof Error ? error.message : String(error),
						);
						continue;
					}

					if (zoneStatus === null) {
						this.options.logger.warn(
							`External domain delegation reminder skipped for ${candidate.id}`,
							`Cloudflare zone ${dns.data.zoneId} no longer exists`,
						);
						continue;
					}

					if (zoneStatus === "active") {
						await this.domains.mergeDnsIfStatus(
							candidate.id,
							["configuring", "active"],
							{ zoneActive: true },
						);
						continue;
					}

					const delegation = await this.delegationStatus(
						candidate.name,
						nameServers,
					);

					if (delegation !== "mismatch") {
						continue;
					}

					const ownerEmail = (
						await this.domains.findOwnerEmail(candidate.userId)
					)?.trim();

					if (!ownerEmail) {
						continue;
					}

					await this.email.sendExternalDomainDelegationReminder({
						dashboardUrl: this.dashboardUrl(candidate.projectId),
						domainId: candidate.id,
						domainName: candidate.name,
						idempotencyKey: this.idempotencyKey(candidate.id),
						nameServers,
						to: ownerEmail,
					});

					try {
						if (await this.markReminderSent(candidate.id)) {
							reminded += 1;
						}
					} catch (error) {
						failed += 1;
						postSendMarkErrors.push(error);
						this.options.logger.warn(
							`External domain delegation reminder mark failed for ${candidate.id}`,
							error instanceof Error ? error.message : String(error),
						);
					}
				} catch (error) {
					failed += 1;
					this.options.logger.warn(
						`External domain delegation reminder failed for ${candidate.id}`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			if (candidates.length < this.batchSize) {
				break;
			}

			const last = candidates.at(-1);

			if (!last) {
				break;
			}

			after = { createdAt: last.createdAt, id: last.id };
		}

		if (postSendMarkErrors.length === 1) {
			throw postSendMarkErrors[0];
		}

		if (postSendMarkErrors.length > 1) {
			throw new AggregateError(
				postSendMarkErrors,
				"External domain delegation reminder marks failed after delivery",
			);
		}

		return { failed, processed: true, reminded };
	}

	private idempotencyKey(domainId: string): string {
		return `external-domain-delegation-reminder:${domainId}`;
	}

	private async markReminderSent(id: string): Promise<boolean> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= REMINDER_MARK_MAX_ATTEMPTS; attempt += 1) {
			try {
				if (await this.domains.markExternalDelegationReminderSent(id)) {
					return true;
				}

				lastError = new Error(
					`External domain delegation reminder CAS did not mark ${id}`,
				);
			} catch (error) {
				lastError = error;
			}

			if (attempt < REMINDER_MARK_MAX_ATTEMPTS) {
				await new Promise<void>((resolve) => {
					setTimeout(resolve, REMINDER_MARK_RETRY_DELAY_MS * attempt);
				});
			}
		}

		throw lastError;
	}

	private async delegationStatus(
		name: string,
		expectedNameservers: readonly string[],
	): Promise<DelegationStatus> {
		try {
			const observedNameservers = await this.withTimeout(
				this.resolveNameservers(name),
			);
			const observed = new Set(
				this.usableNameservers(observedNameservers).map((value) =>
					this.comparableNameserver(value),
				),
			);

			if (observed.size === 0) {
				return "inconclusive";
			}

			const expected = new Set(
				expectedNameservers.map((value) => this.comparableNameserver(value)),
			);
			const matches =
				observed.size === expected.size &&
				[...expected].every((value) => observed.has(value));

			return matches ? "delegated" : "mismatch";
		} catch {
			return "inconclusive";
		}
	}

	private isEligible(
		candidate: ExternalDomainDelegationReminderCandidate,
		dns: { apexConfigured?: boolean; zoneNameserversExposedAt?: string },
		createdBefore: Date,
	): boolean {
		const ageAnchor = dns.zoneNameserversExposedAt
			? new Date(dns.zoneNameserversExposedAt)
			: candidate.createdAt;

		return (
			candidate.source === "external" &&
			candidate.externalDelegationReminderSentAt === null &&
			dns.apexConfigured === true &&
			ageAnchor < createdBefore
		);
	}

	private dashboardUrl(projectId: string | null): string {
		const path = projectId
			? `/p/${encodeURIComponent(projectId)}?tab=settings`
			: "/dashboard";

		return new URL(path, this.options.dashboardOrigin).toString();
	}

	private usableNameservers(
		values: readonly string[] | null | undefined,
	): string[] {
		return values?.map((value) => value.trim()).filter(Boolean) ?? [];
	}

	private comparableNameserver(value: string): string {
		return value.trim().replace(/\.+$/, "").toLowerCase();
	}

	private async withTimeout<T>(query: Promise<T>): Promise<T> {
		let timeout: ReturnType<typeof setTimeout> | undefined;

		try {
			return await Promise.race([
				query,
				new Promise<T>((_resolve, reject) => {
					timeout = setTimeout(
						() => reject(new Error("DNS query timed out")),
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
