import type { DomainStatus } from "@wandit/contracts";

import {
	bestEffortDeleteCustomHostname,
	bestEffortDeleteDomainPointer,
} from "./domain-assets-cleanup";
import type {
	DomainFulfillmentLogger,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

export type DomainActivationResult =
	| {
			processed: false;
			reason: "detached" | "state_changed";
	  }
	| {
			processed: true;
			row: DomainFulfillmentRow;
			status: "active";
	  };

export class DomainActivationTransientError extends Error {
	constructor(readonly providerError: unknown) {
		super(
			providerError instanceof Error
				? providerError.message
				: String(providerError),
		);
		this.name = "DomainActivationTransientError";
	}
}

type DomainActivationDependencies = {
	deleteCustomHostname(id: string): Promise<void>;
	deleteDomainPointer(name: string): Promise<void>;
	findDomain(domainId: string): Promise<DomainFulfillmentRow | null>;
	logger: DomainFulfillmentLogger;
	markDomainFailed(
		domainId: string,
		summary: string,
	): Promise<DomainFulfillmentRow>;
	markOrderFulfilled(orderId: string): Promise<unknown>;
	putDomainPointer(
		name: string,
		pointer: { projectId: string; source: "domain" },
	): Promise<void>;
	updateDomainIfStatus(
		domainId: string,
		statuses: DomainStatus[],
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow | null>;
};

export class DomainActivationStep {
	constructor(private readonly dependencies: DomainActivationDependencies) {}

	async execute(row: DomainFulfillmentRow): Promise<DomainActivationResult> {
		if (row.status === "active") {
			await this.markOrderFulfilled(row);

			return { processed: true, row, status: "active" };
		}

		if (row.status === "failed") {
			await this.cleanupFailedActivation(row);

			return { processed: false, reason: "state_changed" };
		}

		if (row.status !== "configuring") {
			return { processed: false, reason: "state_changed" };
		}

		if (!row.projectId) {
			if (row.paymentOrderId) {
				return this.activateAndComplete(row);
			}

			await bestEffortDeleteCustomHostname(row, this.dependencies);
			await this.dependencies.markDomainFailed(
				row.id,
				"Domain is no longer attached to a project",
			);

			return { processed: false, reason: "detached" };
		}

		try {
			await this.dependencies.putDomainPointer(row.name, {
				projectId: row.projectId,
				source: "domain",
			});
		} catch (error) {
			throw new DomainActivationTransientError(error);
		}

		return this.activateAndComplete(row);
	}

	private async activateAndComplete(
		row: DomainFulfillmentRow,
	): Promise<DomainActivationResult> {
		const active = await this.activateConfiguredDomain(row);

		if (!active) {
			return { processed: false, reason: "state_changed" };
		}

		await this.markOrderFulfilled(active);

		return { processed: true, row: active, status: "active" };
	}

	private async activateConfiguredDomain(
		row: DomainFulfillmentRow,
	): Promise<DomainFulfillmentRow | null> {
		// Keep this CAS/race outcome aligned with DomainsService.activateDomain.
		// The API path and this task path both accept an active winner and remove
		// the already-published pointer after any other state wins.
		const active = await this.dependencies.updateDomainIfStatus(
			row.id,
			["configuring"],
			{ error: null, status: "active" },
		);

		if (active) {
			return active;
		}

		const current = await this.dependencies.findDomain(row.id);

		if (current?.status === "active") {
			return current;
		}

		if (current?.status === "failed") {
			await this.cleanupFailedActivation(current);

			return null;
		}

		await bestEffortDeleteDomainPointer(row, this.dependencies);

		return null;
	}

	private async cleanupFailedActivation(
		row: DomainFulfillmentRow,
	): Promise<void> {
		const hostnameDeleted = await bestEffortDeleteCustomHostname(
			row,
			this.dependencies,
		);
		await bestEffortDeleteDomainPointer(row, this.dependencies);

		if (hostnameDeleted) {
			await this.dependencies.updateDomainIfStatus(row.id, ["failed"], {
				cfCustomHostnameId: null,
			});
		}
	}

	private async markOrderFulfilled(row: DomainFulfillmentRow): Promise<void> {
		if (!row.paymentOrderId) {
			return;
		}

		await this.dependencies.markOrderFulfilled(row.paymentOrderId);
	}
}
