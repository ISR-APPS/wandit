import { Inject, Injectable, Logger } from "@nestjs/common";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import {
	SignupGrantOutboxRepository,
	type SignupGrantOutboxRow,
} from "../../infrastructure/persistence/signup-grant-outbox.repository";

const SIGNUP_GRANT_SWEEP_LIMIT = 100;
const SIGNUP_GRANT_BACKFILL_LIMIT = 1_000;

/**
 * Deploy watermark for the self-healing insert: users created before the
 * outbox existed are reached only through the explicit admin backfill, so a
 * toggle flip never grants to the whole historical user base by accident.
 */
export const SIGNUP_GRANT_SELF_HEAL_WATERMARK = new Date(
	"2026-08-22T00:00:00.000Z",
);

export type SignupGrantSweepResult = {
	done: number;
	failed: number;
	healed: number;
};

export type SignupGrantBackfillResult = {
	requeued: number;
	skipped: number;
};

@Injectable()
export class SignupGrantOutboxService {
	private readonly logger = new Logger(SignupGrantOutboxService.name);

	constructor(
		@Inject(SignupGrantOutboxRepository)
		private readonly outboxRepository: SignupGrantOutboxRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(ProductSettingsService)
		private readonly settingsService: ProductSettingsService,
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
		const healed = userId ? 0 : await this.healMissingRows();
		const rows = await this.outboxRepository.listPending({
			limit: SIGNUP_GRANT_SWEEP_LIMIT,
			...(userId ? { userId } : {}),
		});
		const result: SignupGrantSweepResult = { done: 0, failed: 0, healed };

		for (const row of rows) {
			if (await this.deliver(row)) {
				result.done += 1;
			} else {
				result.failed += 1;
			}
		}

		return result;
	}

	/**
	 * Inserts the outbox rows the signup callback lost, with the settings
	 * snapshot current at sweep time. Delivery stays keyed per user, so this
	 * is at-least-once creation on top of idempotent delivery.
	 */
	async healMissingRows(): Promise<number> {
		const userIds = await this.outboxRepository.findUsersWithoutOutboxRow({
			createdAfter: SIGNUP_GRANT_SELF_HEAL_WATERMARK,
			limit: SIGNUP_GRANT_SWEEP_LIMIT,
		});

		if (userIds.length === 0) {
			return 0;
		}

		const settings = await this.settingsService.get();
		let healed = 0;

		for (const userId of userIds) {
			await this.outboxRepository.create({
				credits: settings.signupGrantCredits,
				settingsVersion: settings.version,
				status: settings.signupGrantEnabled ? "pending" : "skipped",
				userId,
			});
			healed += 1;
		}

		this.logger.warn(
			`SIGNUP_GRANT_OUTBOX_HEALED rows=${healed} — signup callbacks lost their outbox insert`,
		);

		return healed;
	}

	countSkipped(createdAfter?: Date): Promise<number> {
		return this.outboxRepository.countSkipped(createdAfter);
	}

	/** Admin-driven; `dryRun` only counts. Requeued rows drain through the sweep. */
	async backfillSkipped(input: {
		createdAfter?: Date;
		dryRun: boolean;
	}): Promise<SignupGrantBackfillResult> {
		const skipped = await this.outboxRepository.countSkipped(
			input.createdAfter,
		);

		if (input.dryRun || skipped === 0) {
			return { requeued: 0, skipped };
		}

		const settings = await this.settingsService.get();

		if (!settings.signupGrantEnabled) {
			throw new Error(
				"Signup grant backfill requires the signup grant to be enabled",
			);
		}

		const requeued = await this.outboxRepository.requeueSkipped({
			createdAfter: input.createdAfter,
			credits: settings.signupGrantCredits,
			limit: SIGNUP_GRANT_BACKFILL_LIMIT,
			settingsVersion: settings.version,
		});
		this.logger.log(
			`SIGNUP_GRANT_BACKFILL requeued=${requeued} skipped_before=${skipped}`,
		);

		return { requeued, skipped };
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
