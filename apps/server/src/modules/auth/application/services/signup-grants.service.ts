import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { TriggerSignupGrantDispatcherService } from "../../infrastructure/trigger/trigger-signup-grant-dispatcher.service";
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
		@Inject(TriggerSignupGrantDispatcherService)
		private readonly dispatcher?: TriggerSignupGrantDispatcherService,
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

		if (!this.dispatcher) {
			this.logger.warn(
				`Signup grant for user ${userId} remains pending; the scheduled Trigger sweep will retry it`,
			);

			return;
		}

		try {
			await this.dispatcher.triggerDelivery(userId);
		} catch (error) {
			// The row is already durable and the scheduled sweep is authoritative.
			// Treat this low-latency Trigger handoff as an optional accelerator.
			this.logger.warn(
				`Signup grant on-demand Trigger handoff failed for user ${userId}; scheduled sweep remains authoritative: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}
