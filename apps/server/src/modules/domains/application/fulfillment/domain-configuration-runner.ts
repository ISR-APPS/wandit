import { domainDnsSchema } from "@wandit/contracts";

import { withoutNameserverRequiredDomainRecords } from "../../domain/domain-provisioning-rules";
import type { CustomHostnameVerificationResult } from "./custom-hostname-verification.step";
import {
	type DomainActivationResult,
	DomainActivationTransientError,
} from "./domain-activation.step";
import type {
	DomainConfigurationCursor,
	DomainConfigurationPayload,
	DomainConfigurationRunResult,
	DomainFulfillmentRow,
	DurableWait,
} from "./domain-fulfillment.contracts";
import {
	buildDomainPurchaseNonce,
	DOMAIN_CONFIGURATION_INITIAL_DELAY_SECONDS,
	DOMAIN_CONFIGURATION_MAX_ATTEMPT,
	DOMAIN_CONFIGURATION_MAX_DELAY_SECONDS,
} from "./domain-fulfillment.contracts";
import { domainTerminalFailureContext } from "./domain-purchase-failure-finalizer";

type DomainConfigurationCursorStore = {
	advanceCursor(
		domainId: string,
		input: {
			expectedAttempt: number;
			nextAttempt: number;
			nextProbeAt: Date;
			nonce: string;
		},
	): Promise<boolean>;
	clearCursor(domainId: string, nonce: string): Promise<boolean>;
	findDomain(domainId: string): Promise<DomainFulfillmentRow | null>;
	initializeCursor(
		domainId: string,
		input: { adoptExistingNonce: boolean; nonce: string },
	): Promise<DomainConfigurationCursor | null>;
	markExternalVerificationStalled(
		domainId: string,
		input: {
			attempts: number;
			expectedAttempt: number;
			nonce: string;
			stalledAt: Date;
		},
	): Promise<boolean>;
	mergeDnsIfStatus(
		domainId: string,
		statuses: ("active" | "configuring")[],
		patch: Record<string, unknown>,
	): Promise<DomainFulfillmentRow | null>;
	readCursor(domainId: string): Promise<DomainConfigurationCursor | null>;
};

type DomainConfigurationRunnerDependencies = {
	activation: {
		execute(row: DomainFulfillmentRow): Promise<DomainActivationResult>;
	};
	/**
	 * Best-effort apex zone pass (purchased rows in the purchase runtime,
	 * external rows in the configuration runtime; the step itself gates on the
	 * row source): purchased rows run it before every probe; external rows probe
	 * ownership first and authorize missing-zone provisioning only after the www
	 * hostname is active. It retries configuration until
	 * `dns.apexConfigured`, then polls the zone / nudges the apex hostname,
	 * never throws, and only merges apex keys, so it cannot disturb this
	 * runner's cursor. Activation never waits on it.
	 */
	apexZone?: {
		execute(
			row: DomainFulfillmentRow,
			options: { allowZoneCreation: boolean },
		): Promise<DomainFulfillmentRow>;
	};
	cursors: DomainConfigurationCursorStore;
	now(): Date;
	terminalFailure: {
		execute(row: DomainFulfillmentRow, error: unknown): Promise<unknown>;
	};
	verification: {
		execute(id: string): Promise<CustomHostnameVerificationResult>;
	};
	wait: DurableWait;
};

export class DomainConfigurationRunner {
	constructor(
		private readonly dependencies: DomainConfigurationRunnerDependencies,
	) {}

	async execute(
		payload: DomainConfigurationPayload,
	): Promise<DomainConfigurationRunResult> {
		const initial = await this.dependencies.cursors.findDomain(
			payload.domainId,
		);

		if (!initial) {
			return {
				processed: false,
				reason: "not_configuring",
				terminalized: false,
			};
		}

		const early = await this.handleTerminalState(initial);

		if (early) {
			return early;
		}

		if (initial.status !== "configuring") {
			return {
				processed: false,
				reason: "not_configuring",
				terminalized: false,
			};
		}

		if (!initial.cfCustomHostnameId) {
			if (initial.source === "purchased") {
				await this.dependencies.terminalFailure.execute(
					initial,
					new Error("Missing Cloudflare custom hostname id"),
				);
				await this.clearCurrentCursor(initial.id);
			}

			return {
				processed: false,
				reason: "missing_cf_hostname",
				terminalized: initial.source === "purchased",
			};
		}

		let cursor = await this.dependencies.cursors.initializeCursor(initial.id, {
			adoptExistingNonce:
				initial.source === "purchased" &&
				initial.paymentOrderId !== null &&
				payload.nonce === buildDomainPurchaseNonce(initial.paymentOrderId),
			nonce: payload.nonce,
		});

		if (!cursor) {
			return {
				processed: false,
				reason: "state_changed",
				terminalized: false,
			};
		}

		while (true) {
			const waited = await this.waitForPersistedDeadline(initial.id, cursor);

			if (!waited) {
				return {
					processed: false,
					reason: "state_changed",
					terminalized: false,
				};
			}

			cursor = waited;
			let row = await this.dependencies.cursors.findDomain(initial.id);

			if (!row) {
				return {
					processed: false,
					reason: "not_configuring",
					terminalized: false,
				};
			}

			const terminal = await this.handleTerminalState(row, cursor.nonce);

			if (terminal) {
				return terminal;
			}

			if (row.status !== "configuring") {
				return {
					processed: false,
					reason: "state_changed",
					terminalized: false,
				};
			}

			const cfCustomHostnameId = row.cfCustomHostnameId;

			if (!cfCustomHostnameId) {
				if (row.source === "purchased") {
					await this.dependencies.terminalFailure.execute(
						row,
						new Error("Missing Cloudflare custom hostname id"),
					);
					await this.dependencies.cursors.clearCursor(row.id, cursor.nonce);
				}

				return {
					processed: false,
					reason: "missing_cf_hostname",
					terminalized: row.source === "purchased",
				};
			}

			let verification: CustomHostnameVerificationResult;

			if (row.source === "external") {
				verification =
					await this.dependencies.verification.execute(cfCustomHostnameId);

				if (this.dependencies.apexZone) {
					row = await this.dependencies.apexZone.execute(row, {
						allowZoneCreation:
							verification.status !== "transient" &&
							verification.hostnameStatus === "active",
					});
				}
			} else {
				if (this.dependencies.apexZone) {
					row = await this.dependencies.apexZone.execute(row, {
						allowZoneCreation: true,
					});
				}

				verification =
					await this.dependencies.verification.execute(cfCustomHostnameId);
			}

			if (verification.status === "active") {
				const activationRow = await this.hideIncompleteExternalZone(row);

				if (!activationRow) {
					return {
						processed: false,
						reason: "state_changed",
						terminalized: false,
					};
				}

				row = activationRow;
				let activation: DomainActivationResult;

				try {
					activation = await this.dependencies.activation.execute(row);
				} catch (error) {
					if (!(error instanceof DomainActivationTransientError)) {
						throw error;
					}

					const terminalResult = await this.finishOrAdvance(
						row,
						cursor,
						error.providerError,
					);

					if (terminalResult) {
						return terminalResult;
					}

					cursor = await this.reloadAdvancedCursor(row.id, cursor);

					if (!cursor) {
						return {
							processed: false,
							reason: "state_changed",
							terminalized: false,
						};
					}
					continue;
				}

				await this.dependencies.cursors.clearCursor(row.id, cursor.nonce);

				return activation.processed
					? { processed: true, status: "active", terminalized: false }
					: {
							processed: false,
							reason: activation.reason,
							terminalized: false,
						};
			}

			const error =
				verification.status === "transient" ? verification.error : undefined;
			const terminalResult = await this.finishOrAdvance(row, cursor, error);

			if (terminalResult) {
				return terminalResult;
			}

			cursor = await this.reloadAdvancedCursor(row.id, cursor);

			if (!cursor) {
				return {
					processed: false,
					reason: "state_changed",
					terminalized: false,
				};
			}
		}
	}

	private async hideIncompleteExternalZone(
		row: DomainFulfillmentRow,
	): Promise<DomainFulfillmentRow | null> {
		if (row.source !== "external") {
			return row;
		}

		const dns = domainDnsSchema.safeParse(row.dns);

		if (!dns.success || !dns.data.zoneId || dns.data.apexConfigured === true) {
			return row;
		}

		return this.dependencies.cursors.mergeDnsIfStatus(row.id, ["configuring"], {
			records: withoutNameserverRequiredDomainRecords(dns.data.records ?? []),
		});
	}

	private async handleTerminalState(
		row: DomainFulfillmentRow,
		cursorNonce?: string,
	): Promise<DomainConfigurationRunResult | null> {
		if (row.status === "failed") {
			const terminal = domainTerminalFailureContext(
				row,
				new Error("Domain registration failed"),
			);

			await this.dependencies.terminalFailure.execute(row, terminal.error);
			await this.clearCursor(row.id, cursorNonce);

			return {
				processed: false,
				reason: "not_configuring",
				terminalized: true,
			};
		}

		if (row.status === "active") {
			await this.dependencies.activation.execute(row);
			await this.clearCursor(row.id, cursorNonce);

			return {
				processed: false,
				reason: "not_configuring",
				terminalized: false,
			};
		}

		return null;
	}

	private async finishOrAdvance(
		row: DomainFulfillmentRow,
		cursor: DomainConfigurationCursor,
		error?: unknown,
	): Promise<DomainConfigurationRunResult | null> {
		if (cursor.nextAttempt >= DOMAIN_CONFIGURATION_MAX_ATTEMPT) {
			if (row.source === "purchased") {
				await this.dependencies.terminalFailure.execute(
					row,
					error ?? new Error("Cloudflare SSL verification timed out"),
				);
				await this.dependencies.cursors.clearCursor(row.id, cursor.nonce);

				return {
					processed: false,
					reason: "timed_out",
					terminalized: true,
				};
			}

			const marked =
				await this.dependencies.cursors.markExternalVerificationStalled(
					row.id,
					{
						attempts: cursor.nextAttempt + 1,
						expectedAttempt: cursor.nextAttempt,
						nonce: cursor.nonce,
						stalledAt: this.dependencies.now(),
					},
				);

			if (!marked) {
				return {
					processed: false,
					reason: "state_changed",
					terminalized: false,
				};
			}

			return {
				processed: false,
				reason: "external_still_pending",
				terminalized: false,
			};
		}

		const nextProbeAt = new Date(
			this.dependencies.now().getTime() +
				domainConfigurationDelaySeconds(cursor.nextAttempt) * 1000,
		);
		const advanced = await this.dependencies.cursors.advanceCursor(row.id, {
			expectedAttempt: cursor.nextAttempt,
			nextAttempt: cursor.nextAttempt + 1,
			nextProbeAt,
			nonce: cursor.nonce,
		});

		if (!advanced) {
			return {
				processed: false,
				reason: "state_changed",
				terminalized: false,
			};
		}

		return null;
	}

	private async reloadAdvancedCursor(
		domainId: string,
		previous: DomainConfigurationCursor,
	): Promise<DomainConfigurationCursor | null> {
		const current = await this.dependencies.cursors.readCursor(domainId);

		if (
			!current ||
			current.nonce !== previous.nonce ||
			current.nextAttempt !== previous.nextAttempt + 1
		) {
			return null;
		}

		return current;
	}

	private async waitForPersistedDeadline(
		domainId: string,
		cursor: DomainConfigurationCursor,
	): Promise<DomainConfigurationCursor | null> {
		if (
			!cursor.nextProbeAt ||
			cursor.nextProbeAt.getTime() <= this.dependencies.now().getTime()
		) {
			return cursor;
		}

		await this.dependencies.wait.until({ date: cursor.nextProbeAt });

		const resumed = await this.dependencies.cursors.readCursor(domainId);

		if (
			!resumed ||
			resumed.nonce !== cursor.nonce ||
			resumed.nextAttempt !== cursor.nextAttempt ||
			resumed.nextProbeAt?.getTime() !== cursor.nextProbeAt.getTime()
		) {
			return null;
		}

		return resumed;
	}

	private async clearCurrentCursor(domainId: string): Promise<void> {
		const cursor = await this.dependencies.cursors.readCursor(domainId);

		if (cursor) {
			await this.dependencies.cursors.clearCursor(domainId, cursor.nonce);
		}
	}

	private async clearCursor(
		domainId: string,
		cursorNonce?: string,
	): Promise<void> {
		if (cursorNonce) {
			await this.dependencies.cursors.clearCursor(domainId, cursorNonce);
			return;
		}

		await this.clearCurrentCursor(domainId);
	}
}

export function domainConfigurationDelaySeconds(attempt: number): number {
	return Math.min(
		DOMAIN_CONFIGURATION_INITIAL_DELAY_SECONDS * 2 ** attempt,
		DOMAIN_CONFIGURATION_MAX_DELAY_SECONDS,
	);
}
