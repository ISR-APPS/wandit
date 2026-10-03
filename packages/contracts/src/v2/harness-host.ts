/**
 * Contract of the harness host process: the HTTP routes the API calls to
 * start and stop host-run builder turns. The API client
 * (`harness-host.client.ts`) writes these bodies; the host
 * (`harness-host.ts`) parses them, because the body crosses a process boundary.
 */
import { z } from "zod";

import { uuidSchema } from "../v1/shared/primitives";

/** The routes of the harness host, relative to `HARNESS_HOST_URL`. */
export const harnessHostRoutes = {
	health: "/health",
	startTurn: (turnId: string) => `/turns/${turnId}/start`,
	cancelTurn: (turnId: string) => `/turns/${turnId}/cancel`,
} as const;

/**
 * Body of `POST /turns/:turnId/start`: the same values as the Trigger task
 * payload. The host re-reads the row for the real state.
 */
export const harnessHostStartTurnSchema = z.object({
	turnId: uuidSchema,
	projectId: uuidSchema,
	// The signed-in user whose submit queued the turn.
	actorUserId: z.string().min(1),
	// The org workspace of the project; null for a personal project.
	organizationId: z.string().min(1).nullable(),
	// ms from the HTTP request start to the row insert; null when promoted.
	apiCreateMs: z.int().nonnegative().nullable(),
});

/** TypeScript start-turn body. */
export type HarnessHostStartTurn = z.infer<typeof harnessHostStartTurnSchema>;
