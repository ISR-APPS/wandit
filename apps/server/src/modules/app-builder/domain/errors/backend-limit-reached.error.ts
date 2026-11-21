/**
 * 403 for a new backend when the owner has no free backend slot (D3,
 * WANDIT-184, pricing v8 section 6). `BackendsService.provisionBackend` throws
 * it before the insert. The Cloud route `POST backend` answers it as the
 * `BACKEND_LIMIT_REACHED` envelope with the limit in `details`;
 * project creation goes on without a backend and logs no error.
 */
import { ForbiddenException } from "@nestjs/common";
import type { BackendLimitDetails } from "@wandit/contracts";

import type { CreditOwner } from "../../../credits/domain/credit-owner";

/** Thrown when the owner already holds the backends that `backendLimitFor` allows. */
export class BackendLimitReachedError extends ForbiddenException {
	constructor(
		/** Backends the owner may hold, from `backendLimitFor`. 0 for a free owner. */
		limit: number,
		/** Kind of the pool that pays for the backend. */
		payerType: CreditOwner["type"],
	) {
		// The wire field `plan` stays for the web of this release, which names a
		// plan in its limit text. A limit of 0 shows no plan name.
		const plan =
			limit === 0 ? "starter" : payerType === "org" ? "business" : "pro";
		super({
			code: "BACKEND_LIMIT_REACHED",
			// ApiExceptionFilter forwards these only for this code. The Cloud tab shows them.
			details: { plan, limit } satisfies BackendLimitDetails,
			message: `Backend limit reached: this workspace allows ${limit}`,
		});
	}
}
