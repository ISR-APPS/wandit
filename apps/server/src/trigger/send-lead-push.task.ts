import { logger, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { sendLeadPush } from "./send-lead-push.runtime";

export const sendLeadPushTask = schemaTask({
	id: "send-lead-push",
	maxDuration: 60,
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	schema: z.object({
		leadId: z.string(),
		leadName: z.string(),
		leadPhone: z.string(),
		projectId: z.string(),
		wilaya: z.string().optional(),
	}),
	run: async (payload, { ctx }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });

		try {
			const result = await sendLeadPush(db, payload, { logger });

			logger.info("Lead push task completed", {
				leadId: payload.leadId,
				projectId: payload.projectId,
				result,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});
