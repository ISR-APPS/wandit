import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
	SIGNUP_GRANT_SWEEP_JOB,
	SIGNUP_GRANTS_QUEUE,
	type SignupGrantSweepJobData,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { SignupGrantOutboxService } from "./signup-grant-outbox.service";

@Injectable()
export class SignupGrantsService {
	private readonly logger = new Logger(SignupGrantsService.name);

	constructor(
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
		@Inject(SignupGrantOutboxService)
		private readonly outboxService: SignupGrantOutboxService,
		@Optional()
		@InjectQueue(SIGNUP_GRANTS_QUEUE)
		private readonly signupGrantsQueue?: Queue<SignupGrantSweepJobData>,
	) {}

	async handleUserCreated(userId: string): Promise<void> {
		const settings = await this.settingsService.get();
		let row: Awaited<ReturnType<SignupGrantOutboxService["create"]>>;

		try {
			row = await this.outboxService.create({
				credits: settings.signupGrantCredits,
				settingsVersion: settings.version,
				status: settings.signupGrantEnabled ? "pending" : "skipped",
				userId,
			});
		} catch (error) {
			this.logger.error(
				`SIGNUP_GRANT_OUTBOX_INSERT_FAILED userId=${userId}`,
				error instanceof Error ? error.stack : String(error),
			);

			return;
		}

		if (row.status !== "pending" || (await this.outboxService.deliver(row))) {
			return;
		}

		if (!this.signupGrantsQueue) {
			this.logger.warn(
				`Signup grant for user ${userId} remains pending because the queue is disabled`,
			);

			return;
		}

		await this.signupGrantsQueue.add(
			SIGNUP_GRANT_SWEEP_JOB,
			{ userId },
			{
				jobId: `signup-grant-${encodeURIComponent(userId)}`,
				removeOnComplete: true,
			},
		);
	}
}
