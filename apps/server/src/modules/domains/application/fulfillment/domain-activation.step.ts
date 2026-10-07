/**
 * Activates a verified custom domain in the `domain-configure` and
 * `domain-purchase` tasks. It writes the KV host pointer, sets the row to
 * `active`, and fulfills a paid order. `DomainConfigurationRunner` calls it.
 * `domain-fulfillment.runtime.ts` wires it. The API twin is
 * `DomainsService.activateDomain`.
 */
import {
	appHostPointer,
	type DomainStatus,
	type HostPointer,
	type ProjectEngine,
	type SuspendedReasonCode,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import {
	bestEffortDeleteCustomHostname,
	bestEffortDeleteDomainPointer,
} from "./domain-assets-cleanup";
import type {
	DomainFulfillmentLogger,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

/**
 * What the project of a custom domain serves. `DomainsRepository` reads it
 * from `projects`; null there means a missing or soft-deleted project.
 */
export type ProjectServing = {
	engine: ProjectEngine;
	/** `projects.suspended_reason_code`. Set while staff suspend the app. */
	suspendedReasonCode: SuspendedReasonCode | null;
};

/**
 * The KV pointer of an active custom domain. A V2 app gets the app pointer.
 * The edge sends the host to the user Worker and keeps a suspension on each
 * new host. A V1 page keeps the version-free `{projectId, source}` pointer.
 */
export function customDomainPointer(
	projectId: string,
	serving: ProjectServing,
): HostPointer {
	if (serving.engine === "v2_app") {
		return appHostPointer({
			projectId,
			slug: null,
			source: "domain",
			suspendedReasonCode: serving.suspendedReasonCode,
		});
	}
	return { projectId, source: "domain" };
}

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
	findProjectServing(projectId: string): Promise<ProjectServing | null>;
	logger: DomainFulfillmentLogger;
	markDomainFailed(
		domainId: string,
		summary: string,
	): Promise<DomainFulfillmentRow>;
	markOrderFulfilled(orderId: string): Promise<unknown>;
	/** Queues the backend login URL sync. The step calls it only for a `v2_app` project. */
	onProjectDomainsChanged(projectId: string): Promise<void>;
	activateExternalDomain(
		domainId: string,
		statuses: Extract<DomainStatus, "active" | "configuring">[],
	): Promise<DomainFulfillmentRow | null>;
	putDomainPointer(name: string, pointer: HostPointer): Promise<void>;
	updateDomainIfStatus(
		domainId: string,
		statuses: DomainStatus[],
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow | null>;
};

/**
 * Idempotent: a replay of an active row only marks its paid order as
 * fulfilled, if the row has one.
 */
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

		const serving = row.projectId
			? await this.publishDomainPointer(row.name, row.projectId)
			: null;

		// A soft-deleted project counts as no project: it gets no new live host.
		if (!serving) {
			if (row.paymentOrderId) {
				return this.activateAndComplete(row, null);
			}

			await bestEffortDeleteCustomHostname(row, this.dependencies);
			await this.dependencies.markDomainFailed(
				row.id,
				"Domain is no longer attached to a project",
			);

			return { processed: false, reason: "detached" };
		}

		return this.activateAndComplete(row, serving);
	}

	/**
	 * Reads the project and writes the pointer of its kind. Returns null and
	 * writes nothing for a missing or soft-deleted project.
	 */
	private async publishDomainPointer(
		name: string,
		projectId: string,
	): Promise<ProjectServing | null> {
		try {
			const serving = await this.dependencies.findProjectServing(projectId);

			if (serving) {
				await this.dependencies.putDomainPointer(
					name,
					customDomainPointer(projectId, serving),
				);
			}

			return serving;
		} catch (error) {
			throw new DomainActivationTransientError(error);
		}
	}

	private async activateAndComplete(
		row: DomainFulfillmentRow,
		serving: ProjectServing | null,
	): Promise<DomainActivationResult> {
		const active = await this.activateConfiguredDomain(row, serving);

		if (!active) {
			return { processed: false, reason: "state_changed" };
		}

		await this.markOrderFulfilled(active);

		return { processed: true, row: active, status: "active" };
	}

	private async activateConfiguredDomain(
		row: DomainFulfillmentRow,
		serving: ProjectServing | null,
	): Promise<DomainFulfillmentRow | null> {
		// Keep this CAS/race outcome aligned with DomainsService.activateDomain.
		// The API path and this task path both accept an active winner and remove
		// the already-published pointer after any other state wins.
		const active =
			row.source === "external"
				? await this.dependencies.activateExternalDomain(row.id, [
						"configuring",
					])
				: await this.dependencies.updateDomainIfStatus(
						row.id,
						["configuring"],
						{ error: null, status: "active" },
					);

		if (active) {
			// Only the CAS winner syncs, so one activation queues one sync.
			if (serving?.engine === "v2_app") {
				await this.recheckSuspension(active, serving);
				await this.syncProjectDomains(active);
			}

			return active;
		}

		const current = await this.dependencies.findDomain(row.id);

		if (current?.status === "active") {
			// The pointer write of this run can land after the recheck of the
			// winner, so this run rechecks too. The winner queues the sync.
			if (serving?.engine === "v2_app") {
				await this.recheckSuspension(current, serving);
			}

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

	// A suspend switch rewrites only active domains. A switch between the
	// first read and the CAS does not see this row. A read after the CAS sees
	// the switch. The domain is already live, so a failure only logs.
	private async recheckSuspension(
		row: DomainFulfillmentRow,
		written: ProjectServing,
	): Promise<void> {
		if (!row.projectId) {
			return;
		}

		try {
			const current = await this.dependencies.findProjectServing(row.projectId);

			if (
				current &&
				current.suspendedReasonCode !== written.suspendedReasonCode
			) {
				await this.dependencies.putDomainPointer(
					row.name,
					customDomainPointer(row.projectId, current),
				);
			}
		} catch (error) {
			this.dependencies.logger.error(
				`Failed to recheck the suspension for domain ${row.id} of project ${row.projectId}`,
				getErrorMessage(error),
			);
		}
	}

	// The domain is already live. A failed sync only delays the login URLs:
	// the sync task also runs after the next publish.
	private async syncProjectDomains(row: DomainFulfillmentRow): Promise<void> {
		if (!row.projectId) {
			return;
		}

		try {
			await this.dependencies.onProjectDomainsChanged(row.projectId);
		} catch (error) {
			this.dependencies.logger.warn(
				`Failed to sync auth URLs for domain ${row.id} of project ${row.projectId}`,
				getErrorMessage(error),
			);
		}
	}

	private async markOrderFulfilled(row: DomainFulfillmentRow): Promise<void> {
		if (!row.paymentOrderId) {
			return;
		}

		await this.dependencies.markOrderFulfilled(row.paymentOrderId);
	}
}
