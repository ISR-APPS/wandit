import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	type CreditBalanceResponse,
	type CreditBucket,
	type CreditLedgerQuery,
	SIGNUP_GRANT_CREDITS,
} from "@wandit/contracts";

import { InsufficientCreditsError } from "../../domain/errors/insufficient-credits.error";
import {
	type CreditLedgerRow,
	CreditsRepository,
	type CreditsTransaction,
} from "../../infrastructure/persistence/credits.repository";

type CreditMeta = Record<string, unknown> & {
	reason?: unknown;
};

type CreditWriteOptions = {
	idempotencyKey?: string;
	meta?: CreditMeta;
};

type GrantCreditOptions = CreditWriteOptions & {
	bucket: CreditBucket;
};

type RevokeCreditOptions = CreditWriteOptions & {
	bucket?: CreditBucket;
};

@Injectable()
export class CreditsService {
	constructor(
		@Inject(CreditsRepository)
		private readonly creditsRepository: CreditsRepository,
	) {}

	getBalance(userId: string): Promise<CreditBalanceResponse> {
		return this.creditsRepository.getBalance(userId);
	}

	listLedger(userId: string, query: CreditLedgerQuery) {
		return this.creditsRepository.listByUser(userId, query);
	}

	async consume(
		userId: string,
		amount: number,
		options: CreditWriteOptions = {},
	): Promise<CreditLedgerRow[]> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(userId, async (tx) => {
			const existingRows = await this.findExistingConsumeRows(
				userId,
				options,
				tx,
			);

			if (existingRows.length > 0) {
				return existingRows;
			}

			const balance = await this.creditsRepository.getBalance(userId, tx);

			if (balance.balance < amount) {
				throw new InsufficientCreditsError(amount, balance.balance);
			}

			const planAmount = Math.min(Math.max(balance.plan, 0), amount);
			const topupAmount = amount - planAmount;
			const rows: CreditLedgerRow[] = [];

			if (planAmount > 0) {
				rows.push(
					await this.creditsRepository.insertLedgerEntry(
						{
							bucket: "plan",
							delta: -planAmount,
							idempotencyKey: this.maybeConsumeIdempotencyKey(
								options.idempotencyKey,
								"plan",
							),
							kind: "consume",
							meta: this.withReason(options.meta, "consume"),
							userId,
						},
						tx,
					),
				);
			}

			if (topupAmount > 0) {
				rows.push(
					await this.creditsRepository.insertLedgerEntry(
						{
							bucket: "topup",
							delta: -topupAmount,
							idempotencyKey: this.maybeConsumeIdempotencyKey(
								options.idempotencyKey,
								"topup",
							),
							kind: "consume",
							meta: this.withReason(options.meta, "consume"),
							userId,
						},
						tx,
					),
				);
			}

			return rows;
		});
	}

	/**
	 * Compensate an idempotent consume, preserving the original plan/top-up
	 * split. Replays return the same refund rows and never credit twice.
	 */
	async refundConsume(
		userId: string,
		consumeIdempotencyKey: string,
		meta: CreditMeta = {},
	): Promise<CreditLedgerRow[]> {
		return this.creditsRepository.withUserLock(userId, async (tx) => {
			const consumedRows = await this.creditsRepository.findByIdempotencyKeys(
				userId,
				[
					this.consumeIdempotencyKey(consumeIdempotencyKey, "plan"),
					this.consumeIdempotencyKey(consumeIdempotencyKey, "topup"),
				],
				tx,
			);
			const refunded: CreditLedgerRow[] = [];

			for (const consumed of consumedRows) {
				if (consumed.delta >= 0) {
					continue;
				}

				refunded.push(
					await this.creditsRepository.insertLedgerEntry(
						{
							bucket: consumed.bucket,
							delta: Math.abs(consumed.delta),
							idempotencyKey: `refund:${consumeIdempotencyKey}:${consumed.bucket}`,
							kind: "grant",
							meta: this.withReason(
								{
									...meta,
									consumeLedgerId: consumed.id,
								},
								"generation_refund",
							),
							userId,
						},
						tx,
					),
				);
			}

			return refunded;
		});
	}

	async grant(
		userId: string,
		amount: number,
		options: GrantCreditOptions,
	): Promise<CreditLedgerRow> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(userId, (tx) =>
			this.creditsRepository.insertLedgerEntry(
				{
					bucket: options.bucket,
					delta: amount,
					idempotencyKey: options.idempotencyKey,
					kind: "grant",
					meta: this.withReason(options.meta, "grant"),
					userId,
				},
				tx,
			),
		);
	}

	async topup(
		userId: string,
		amount: number,
		options: CreditWriteOptions = {},
	): Promise<CreditLedgerRow> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(userId, (tx) =>
			this.creditsRepository.insertLedgerEntry(
				{
					bucket: "topup",
					delta: amount,
					idempotencyKey: options.idempotencyKey,
					kind: "topup",
					meta: this.withReason(options.meta, "topup"),
					userId,
				},
				tx,
			),
		);
	}

	async expirePlanRemainder(
		userId: string,
		options: CreditWriteOptions = {},
	): Promise<number> {
		return this.creditsRepository.withUserLock(userId, async (tx) => {
			const existingAmount = await this.findExistingNegativeAmount(
				userId,
				options.idempotencyKey,
				tx,
			);

			if (existingAmount !== null) {
				return existingAmount;
			}

			const balance = await this.creditsRepository.getBalance(userId, tx);
			const amountToExpire = Math.max(balance.plan, 0);

			if (amountToExpire === 0) {
				return 0;
			}

			await this.creditsRepository.insertLedgerEntry(
				{
					bucket: "plan",
					delta: -amountToExpire,
					idempotencyKey: options.idempotencyKey,
					kind: "expire",
					meta: this.withReason(options.meta, "plan_expiration"),
					userId,
				},
				tx,
			);

			return amountToExpire;
		});
	}

	async expireAmount(
		userId: string,
		amount: number,
		options: CreditWriteOptions = {},
	): Promise<number> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(userId, async (tx) => {
			const existingAmount = await this.findExistingNegativeAmount(
				userId,
				options.idempotencyKey,
				tx,
			);

			if (existingAmount !== null) {
				return existingAmount;
			}

			const balance = await this.creditsRepository.getBalance(userId, tx);
			const amountToExpire = Math.min(amount, Math.max(balance.plan, 0));

			if (amountToExpire === 0) {
				return 0;
			}

			await this.creditsRepository.insertLedgerEntry(
				{
					bucket: "plan",
					delta: -amountToExpire,
					idempotencyKey: options.idempotencyKey,
					kind: "expire",
					meta: this.withReason(options.meta, "plan_expiration"),
					userId,
				},
				tx,
			);

			return amountToExpire;
		});
	}

	async revoke(
		userId: string,
		amount: number,
		options: RevokeCreditOptions = {},
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(
			userId,
			(tx) =>
				this.creditsRepository.insertLedgerEntry(
					{
						// Preserve the existing top-up default for untouched callers.
						bucket: options.bucket ?? "topup",
						delta: -amount,
						idempotencyKey: options.idempotencyKey,
						kind: "revoke",
						meta: this.withReason(options.meta, "revoke"),
						userId,
					},
					tx,
				),
			transaction,
		);
	}

	grantSignupCredits(userId: string): Promise<CreditLedgerRow> {
		return this.grant(userId, SIGNUP_GRANT_CREDITS, {
			bucket: "plan",
			idempotencyKey: `signup:${userId}`,
			meta: { reason: "signup_grant" },
		});
	}

	private async findExistingConsumeRows(
		userId: string,
		options: CreditWriteOptions,
		tx: CreditsTransaction,
	) {
		if (!options.idempotencyKey) {
			return [];
		}

		const idempotencyKey = options.idempotencyKey;

		return this.creditsRepository.findByIdempotencyKeys(
			userId,
			[
				this.consumeIdempotencyKey(idempotencyKey, "plan"),
				this.consumeIdempotencyKey(idempotencyKey, "topup"),
			],
			tx,
		);
	}

	private async findExistingNegativeAmount(
		userId: string,
		idempotencyKey: string | undefined,
		tx: CreditsTransaction,
	) {
		if (!idempotencyKey) {
			return null;
		}

		const existing = await this.creditsRepository.findByIdempotencyKeys(
			userId,
			[idempotencyKey],
			tx,
		);

		if (!existing[0]) {
			return null;
		}

		return Math.abs(existing[0].delta);
	}

	private consumeIdempotencyKey(idempotencyKey: string, bucket: CreditBucket) {
		return `${idempotencyKey}:${bucket}`;
	}

	private maybeConsumeIdempotencyKey(
		idempotencyKey: string | undefined,
		bucket: CreditBucket,
	) {
		return idempotencyKey
			? this.consumeIdempotencyKey(idempotencyKey, bucket)
			: undefined;
	}

	private withReason(meta: CreditMeta | undefined, defaultReason: string) {
		return {
			...(meta ?? {}),
			reason:
				typeof meta?.reason === "string" && meta.reason.length > 0
					? meta.reason
					: defaultReason,
		};
	}

	private assertPositiveCreditAmount(amount: number) {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new BadRequestException("Credit amount must be a positive integer");
		}
	}
}
