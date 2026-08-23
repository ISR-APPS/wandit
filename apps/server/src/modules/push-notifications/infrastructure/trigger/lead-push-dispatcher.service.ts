import { Injectable, Logger } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";

import type { sendLeadPushTask } from "../../../../trigger/send-lead-push.task";

const SEND_LEAD_PUSH_TASK_ID = "send-lead-push";

export type LeadCapturedPushPayload = {
	leadId: string;
	leadName: string;
	leadPhone: string;
	projectId: string;
	wilaya?: string;
};

@Injectable()
export class LeadPushDispatcherService {
	private readonly logger = new Logger(LeadPushDispatcherService.name);

	async dispatchLeadCaptured(payload: LeadCapturedPushPayload): Promise<void> {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			this.logger.debug(
				`Skipping lead push dispatch for ${payload.leadId}: Trigger.dev is not configured`,
			);
			return;
		}

		const idempotencyKey = await idempotencyKeys.create(
			`lead-push:${payload.leadId}`,
			{ scope: "global" },
		);

		await tasks.trigger<typeof sendLeadPushTask>(
			SEND_LEAD_PUSH_TASK_ID,
			payload,
			{
				idempotencyKey,
				tags: [`project:${payload.projectId}`],
			},
		);
	}
}
