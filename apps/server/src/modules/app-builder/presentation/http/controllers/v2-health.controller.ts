/**
 * `GET /api/v2/health`: reports the V2 rollout state and which optional
 * env values are set. Ops and deploy checks call it; it calls
 * `v2EnvPresence`. The global AuthGuard already requires a session —
 * no `@Public()` here on purpose.
 */
import { Controller, Get, Inject } from "@nestjs/common";
import type { V2HealthResponse } from "@wandit/contracts";

import {
	V2_ENV,
	type V2EnvSource,
	v2EnvPresence,
} from "../../../infrastructure/env/v2-env";

/** `GET /api/v2/health`: the V2 switches and which env values are set. */
@Controller("v2/health")
export class V2HealthController {
	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	@Get()
	health(): V2HealthResponse {
		return {
			enabled: true,
			harness: this.v2Env.V2_HARNESS,
			model: this.v2Env.V2_DEFAULT_MODEL ?? null,
			env: v2EnvPresence(this.v2Env),
		};
	}
}
