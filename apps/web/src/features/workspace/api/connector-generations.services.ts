// Raw async functions for connector generations — NO React in here. Thin
// fetch wrapper over the shared api-client; the response is parsed with the
// @wandit/contracts Zod schema so a drifted server shape fails loudly here.

import {
	type ConnectorGenerationAttempt,
	connectorGenerationAttemptSchema,
	connectorGenerationsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * One attempt's state — read when the Realtime run settles, or polled as a
 * fallback (see useConnectorGenerationAttemptQuery).
 */
export async function getConnectorGenerationAttempt(
	attemptId: string,
): Promise<ConnectorGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		connectorGenerationsRoutes.attempt(attemptId),
	);
	return connectorGenerationAttemptSchema.parse(data);
}
