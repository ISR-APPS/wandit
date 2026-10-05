/**
 * 403 for a new backend when the owner's plan has no free slot (D3,
 * WANDIT-184). `BackendsService.provisionBackend` throws it before the
 * insert. The Cloud route `POST backend` answers it as the
 * `BACKEND_LIMIT_REACHED` envelope with the plan and the limit in `details`;
 * project creation goes on without a backend and logs no error.
 */
import { ForbiddenException } from "@nestjs/common";
import type { BackendLimitDetails, BillingPlanId } from "@wandit/contracts";

/** Thrown when the owner already holds the backends its plan allows. */
export class BackendLimitReachedError extends ForbiddenException {
	constructor(
		/** The plan of the owner that pays for the backend. */
		plan: BillingPlanId,
		/** Backends the plan allows, from `BACKEND_DEFAULTS.backendsPerPlan`. */
		limit: number,
	) {
		super({
			code: "BACKEND_LIMIT_REACHED",
			// ApiExceptionFilter forwards these only for this code. The Cloud tab shows them.
			details: { plan, limit } satisfies BackendLimitDetails,
			message: `Backend limit reached: the ${plan} plan allows ${limit}`,
		});
	}
}
