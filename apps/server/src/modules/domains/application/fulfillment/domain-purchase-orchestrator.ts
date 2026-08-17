import type {
	DomainConfigurationRunResult,
	DomainFulfillmentRow,
	DomainPurchasePayload,
} from "./domain-fulfillment.contracts";
import { buildDomainPurchaseNonce } from "./domain-fulfillment.contracts";
import {
	isImmediateTerminalDomainError,
	OrderFulfillmentStoppedError,
} from "./domain-fulfillment.errors";
import type { DomainPurchaseStateResult } from "./domain-fulfillment-state.service";

export type DomainPurchaseRunResult =
	| DomainConfigurationRunResult
	| {
			processed: false;
			reason:
				| "already_active"
				| "financial_race"
				| "not_registering"
				| "order_not_fulfillable"
				| "terminal_failure";
			terminalized: boolean;
	  };

type DomainPurchaseOrchestratorDependencies = {
	apexHostname: {
		execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow>;
	};
	configuration: {
		execute(input: {
			domainId: string;
			nonce: string;
		}): Promise<DomainConfigurationRunResult>;
	};
	customHostname: {
		execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow>;
	};
	purchasedDns: {
		execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow>;
	};
	registration: {
		execute(
			row: DomainFulfillmentRow,
			orderId: string | null,
		): Promise<DomainFulfillmentRow>;
	};
	state: {
		preparePurchase(
			payload: DomainPurchasePayload,
		): Promise<DomainPurchaseStateResult>;
		transitionToConfiguring(
			row: DomainFulfillmentRow,
		): Promise<DomainFulfillmentRow>;
	};
	terminalFailure: {
		execute(
			row: DomainFulfillmentRow,
			error: unknown,
			options?: { orderId: string | null },
		): Promise<unknown>;
	};
};

export class DomainPurchaseOrchestrator {
	constructor(
		private readonly dependencies: DomainPurchaseOrchestratorDependencies,
	) {}

	async execute(
		payload: DomainPurchasePayload,
	): Promise<DomainPurchaseRunResult> {
		const state = await this.dependencies.state.preparePurchase(payload);

		if (state.kind === "stopped") {
			return {
				processed: false,
				reason: state.reason,
				terminalized: false,
			};
		}

		if (state.kind === "terminal") {
			await this.dependencies.terminalFailure.execute(state.row, state.error, {
				orderId: state.orderId,
			});

			return {
				processed: false,
				reason: "terminal_failure",
				terminalized: true,
			};
		}

		if (state.kind === "configure") {
			return this.dependencies.configuration.execute({
				domainId: state.row.id,
				nonce: state.nonce,
			});
		}

		let row = state.row;

		try {
			row = await this.dependencies.registration.execute(row, state.orderId);
			row = await this.dependencies.purchasedDns.execute(row);
			row = await this.dependencies.customHostname.execute(row);
			// Best-effort by contract: the apex step never throws, so an apex
			// hiccup cannot fail or delay the www path below.
			row = await this.dependencies.apexHostname.execute(row);
			row = await this.dependencies.state.transitionToConfiguring(row);

			return await this.dependencies.configuration.execute({
				domainId: row.id,
				nonce: buildDomainPurchaseNonce(state.orderId),
			});
		} catch (error) {
			if (error instanceof OrderFulfillmentStoppedError) {
				if (error.reason === "financial_race") {
					await this.dependencies.terminalFailure.execute(row, error);
				}

				return {
					processed: false,
					reason: error.reason,
					terminalized: error.reason === "financial_race",
				};
			}

			if (!isImmediateTerminalDomainError(error)) {
				throw error;
			}

			await this.dependencies.terminalFailure.execute(row, error);

			return {
				processed: false,
				reason: "terminal_failure",
				terminalized: true,
			};
		}
	}
}
