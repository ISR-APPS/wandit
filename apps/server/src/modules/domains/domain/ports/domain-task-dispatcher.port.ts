import type {
	DomainConfigurationPayload,
	DomainPurchasePayload,
} from "../../application/fulfillment/domain-fulfillment.contracts";

export const DOMAIN_TASK_DISPATCHER = Symbol("DOMAIN_TASK_DISPATCHER");

export type DomainTaskHandle = {
	id: string;
};

/**
 * Durable domain-task handoff without leaking Trigger.dev into application
 * services. Recovery is deliberately separate from ordinary producer calls:
 * only the DB-backed reconciler may inspect/reset a terminal run key.
 */
export interface DomainTaskDispatcher {
	assertAvailable(): void;
	recoverConfiguration?(
		payload: DomainConfigurationPayload,
	): Promise<DomainTaskHandle>;
	recoverPurchase(payload: DomainPurchasePayload): Promise<DomainTaskHandle>;
	triggerConfiguration(
		payload: DomainConfigurationPayload,
	): Promise<DomainTaskHandle>;
	triggerPurchase(payload: DomainPurchasePayload): Promise<DomainTaskHandle>;
}
