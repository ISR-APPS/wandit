/**
 * The payer's billing plan for the LLM allow-list.
 * `turns.service.ts` calls it before accepting `body.model`; the
 * `builder-turn` task calls it to mint the run token.
 * Calls `SubscriptionsRepository.findActiveByOwner`.
 */
import type { BillingPlanId } from "@wandit/contracts";

import {
	type MeteringSubject,
	subjectPayer,
} from "../../../credits/domain/credit-owner";
import type { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";

/**
 * The plan that decides which models `llmProxyAllowedModels` allows for
 * the subject's pool. `subjectPayer` picks the org pool when the subject
 * carries an organization.
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
