/**
 * The payer's billing plan for the LLM allow-list and the backend limit.
 * `turns.service.ts` calls it before accepting `body.model`; the
 * `builder-turn` task calls it to mint the run token; `BackendsService`
 * calls it for the D3 backend limit. Calls `findActiveByOwner`.
 */
import type { BillingPlanId } from "@wandit/contracts";

import {
	type MeteringSubject,
	subjectPayer,
} from "../../../credits/domain/credit-owner";
import type { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";

/**
 * The plan of the subject's pool: it decides the models
 * `llmProxyAllowedModels` allows and the backends the pool may hold.
 * `subjectPayer` picks the org pool when the subject carries an organization.
 */
export async function resolveBillingPlan(
	subscriptions: Pick<SubscriptionsRepository, "findActiveByOwner">,
	subject: MeteringSubject,
): Promise<BillingPlanId> {
	const row = await subscriptions.findActiveByOwner(subjectPayer(subject));
	// The billing_plan enum has no free value; starter is the free tier
	// (llm-proxy.ts).
	return row?.plan ?? "starter";
}
