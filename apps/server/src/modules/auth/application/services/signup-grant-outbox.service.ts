import { Inject, Injectable, Logger } from "@nestjs/common";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	SignupGrantOutboxRepository,
	type SignupGrantOutboxRow,
} from "../../infrastructure/persistence/signup-grant-outbox.repository";

const SIGNUP_GRANT_SWEEP_LIMIT = 100;

export type SignupGrantSweepResult = {
	done: number;
	failed: number;
};

@Injectable()
export class SignupGrantOutboxService {
	private readonly logger = new Logger(SignupGrantOutboxService.name);

	constructor(
		@Inject(SignupGrantOutboxRepository)
		private readonly outboxRepository: SignupGrantOutboxRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	create(input: {
		credits: number;
		settingsVersion: number;
		status: SignupGrantOutboxRow["status"];
		userId: string;
	}): Promise<SignupGrantOutboxRow> {
		return this.outboxRepository.create(input);
	}

	async sweep(userId?: string): Promise<SignupGrantSweepResult> {
		const rows = await this.outboxRepository.listPending({
			limit: SIGNUP_GRANT_SWEEP_LIMIT,
			...(userId ? { userId } : {}),
		});
		const result: SignupGrantSweepResult = { done: 0, failed: 0 };

		for (const row of rows) {
			if (await this.deliver(row)) {
				result.done += 1;
			} else {
				result.failed += 1;
			}
		}

		return result;
	}

	async deliver(row: SignupGrantOutboxRow): Promise<boolean> {
		if (row.status !== "pending") {
			return row.status === "done";
		}

		try {
			await this.creditsService.grantSignupCredits(row.userId, row.credits);
			await this.outboxRepository.markDone(row.userId);

			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.outboxRepository.markFailed(row.userId, message);
			this.logger.error(
				`Signup grant delivery failed for user ${row.userId}`,
				message,
			);

			return false;
		}
	}
}
