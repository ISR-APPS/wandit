/**
 * Reports builder diagnostics for local development.
 * Calls v2EnvPresence after the global AuthGuard checks the session.
 * Deployed servers use the separate /api/health route for health checks.
 */
import { Controller, Get, Inject, NotFoundException } from "@nestjs/common";
import type { V2HealthResponse } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import {
	V2_ENV,
	type V2EnvSource,
	v2EnvPresence,
} from "../../../infrastructure/env/v2-env";

/** Keeps model and provider diagnostics off deployed API responses. */
@Controller("v2/health")
export class V2HealthController {
	constructor(
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	@Get()
	health(): V2HealthResponse {
		// A normal session must not expose deployment configuration.
		if (env.NODE_ENV !== "development") {
			throw new NotFoundException();
		}
		return {
			enabled: true,
			harness: this.v2Env.V2_HARNESS,
			model: this.v2Env.V2_DEFAULT_MODEL ?? null,
			env: v2EnvPresence(this.v2Env),
		};
	}
}
