import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	CREDIT_SPEND_ORDER,
	type CreditBalanceResponse,
	type CreditBucket,
	type CreditLedgerQuery,
	SIGNUP_GRANT_CREDITS,
} from "@wandit/contracts";

import { InsufficientCreditsError } from "../../domain/errors/insufficient-credits.error";
import {
	type CreditLedgerRow,
	type CreditPlanHoldRow,
	CreditsRepository,
	type CreditsTransaction,
} from "../../infrastructure/persistence/credits.repository";

type CreditMeta = Record<string, unknown> & {
	reason?: unknown;
};

type CreditWriteOptions = {
	/** Metering-only escape hatch for post-provider settlement debt. */
	allowOverdraft?: boolean;
	idempotencyKey?: string;
	meta?: CreditMeta;
	/**
	 * Persist refundable plan entitlement for a metering consume. Active holds
	 * still represent unresolved reservations and participate in rollover.
	 */
	planHold?: "active" | "inactive";
};

type CreditBucketSplit = Record<CreditBucket, number>;

type GrantCreditOptions = CreditWriteOptions & {
	bucket: CreditBucket;
};

export type GrantCreditResult = {
	replayed: boolean;
	row: CreditLedgerRow;
};

export type CappedRefillResult = {
	carriedCredits: number;
	expiredCredits: number;
	grant: CreditLedgerRow;
	preRefillPlanBalance: number;
	replayed: boolean;
};

export type CappedRefillOptions = {
	capMultiplier?: number;
	idempotencyKey: string;
	meta?: CreditMeta;
};

export type RefundConsumeAmountOptions = {
	amount: number;
	idempotencyKey: string;
	meta?: CreditMeta;
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
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow[]> {
		this.assertPositiveCreditAmount(amount);

		if (options.planHold && !options.idempotencyKey) {
			throw new BadRequestException(
				"Tracked plan holds require an idempotency key",
			);
		}

		const consume = async (tx: CreditsTransaction) => {
			const action = this.consumeAction(options.meta);
			const existingRows = await this.findExistingConsumeRows(options, tx);

			if (existingRows.length > 0) {
				this.assertConsumeReplayMatches(
					existingRows,
					userId,
					amount,
					action,
					options.allowOverdraft === true,
					options.planHold ?? null,
					options.idempotencyKey,
				);
				await this.assertPlanHoldReplayMatches(
					existingRows,
					userId,
					options.idempotencyKey,
					options.planHold,
					tx,
				);

				return existingRows;
			}

			const balance = await this.creditsRepository.getBalance(userId, tx);

			if (!options.allowOverdraft && balance.balance < amount) {
				throw new InsufficientCreditsError(amount, balance.balance);
			}

			const bucketSplit = this.buildConsumeBucketSplit(
				balance,
				amount,
				options.allowOverdraft === true,
			);
			const rows: CreditLedgerRow[] = [];

			for (const bucket of CREDIT_SPEND_ORDER) {
				const bucketAmount = bucketSplit[bucket];

				if (bucketAmount === 0) {
					continue;
				}

				rows.push(
					await this.creditsRepository.insertLedgerEntry(
						{
							bucket,
							delta: -bucketAmount,
							idempotencyKey: this.maybeConsumeIdempotencyKey(
								options.idempotencyKey,
								bucket,
							),
							kind: "consume",
							meta: this.withConsumeFingerprint(
								options.meta,
								userId,
								amount,
								action,
								options.allowOverdraft === true,
								bucketSplit,
								options.planHold ?? null,
							),
							userId,
						},
						tx,
					),
				);
			}

			if (options.idempotencyKey) {
				this.assertConsumeReplayMatches(
					rows,
					userId,
					amount,
					action,
					options.allowOverdraft === true,
					options.planHold ?? null,
					options.idempotencyKey,
				);
			}

			await this.ensurePlanHold(
				rows,
				userId,
				options.idempotencyKey,
				options.planHold,
				tx,
			);

			return rows;
		};

		if (!options.idempotencyKey) {
			return this.creditsRepository.withUserLock(userId, consume, transaction);
		}

		// A ledger key is global while the normal balance lock is per user. Take
		// the operation lock first so two owners cannot race disjoint bucket rows
		// under the same base key.
		return this.creditsRepository.withUserLock(
			this.consumeOperationLockKey(options.idempotencyKey),
			(tx) => this.creditsRepository.withUserLock(userId, consume, tx),
			transaction,
		);
	}

	/**
	 * Compensate an idempotent consume, preserving the original plan/top-up
	 * split. Replays return the same refund rows and never credit twice.
	 */
	async refundConsume(
		userId: string,
		consumeIdempotencyKey: string,
		meta: CreditMeta = {},
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow[]> {
		return this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				const consumedRows = await this.creditsRepository.findByIdempotencyKeys(
					userId,
					CREDIT_SPEND_ORDER.map((bucket) =>
						this.consumeIdempotencyKey(consumeIdempotencyKey, bucket),
					),
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
			},
			transaction,
		);
	}

	/**
	 * Refund part of an idempotent consume while preserving the bucket result
	 * that a smaller original consume would have produced. Refunds therefore
	 * unwind topup -> promo -> plan and use one stable key per restored bucket.
	 */
	async refundConsumeAmount(
		userId: string,
		consumeIdempotencyKey: string,
		options: RefundConsumeAmountOptions,
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow[]> {
		this.assertPositiveCreditAmount(options.amount);

		const refund = async (tx: CreditsTransaction) => {
			const consumedRows = await this.findExistingConsumeRows(
				{ idempotencyKey: consumeIdempotencyKey },
				tx,
			);
			const fingerprint = this.consumeFingerprint(consumedRows[0]);
			const totalConsumed = consumedRows.reduce(
				(total, row) => total + Math.max(0, -row.delta),
				0,
			);

			if (totalConsumed === 0) {
				throw new Error(
					`Cannot refund missing credit consume ${consumeIdempotencyKey}`,
				);
			}

			const fingerprintAmount = this.integer(fingerprint?.amount);
			const fingerprintAction = fingerprint?.action;

			if (
				fingerprintAmount === null ||
				(fingerprintAction !== null && typeof fingerprintAction !== "string")
			) {
				throw new Error(
					`Credit consume replay conflict for key ${consumeIdempotencyKey}`,
				);
			}

			this.assertConsumeReplayMatches(
				consumedRows,
				userId,
				fingerprintAmount,
				fingerprintAction,
				fingerprint?.allowOverdraft === true,
				this.readPlanHoldMode(fingerprint?.planHold),
				consumeIdempotencyKey,
			);

			if (options.amount > totalConsumed) {
				throw new Error(
					`Credit refund ${options.idempotencyKey} exceeds consume ${consumeIdempotencyKey}`,
				);
			}

			const consumedSplit: CreditBucketSplit = {
				plan: 0,
				promo: 0,
				topup: 0,
			};

			for (const row of consumedRows) {
				if (row.userId !== userId || row.kind !== "consume" || row.delta >= 0) {
					throw new Error(
						`Credit consume replay conflict for key ${consumeIdempotencyKey}`,
					);
				}

				consumedSplit[row.bucket] += Math.abs(row.delta);
			}

			const existingRefundRows =
				await this.creditsRepository.findByIdempotencyKeys(
					userId,
					CREDIT_SPEND_ORDER.map(
						(bucket) => `${options.idempotencyKey}:${bucket}`,
					),
					tx,
				);

			if (existingRefundRows.length > 0) {
				return this.assertRefundReplaySetMatches(
					existingRefundRows,
					userId,
					consumeIdempotencyKey,
					options,
				);
			}

			const requestedRefundSplit = this.buildRefundBucketSplit(
				consumedSplit,
				options.amount,
			);
			const planHold = await this.creditsRepository.findPlanHold(
				consumeIdempotencyKey,
				tx,
			);
			const trackedPlanHold = this.readPlanHoldMode(fingerprint?.planHold);

			if (trackedPlanHold && consumedSplit.plan > 0 && !planHold) {
				throw new Error(
					`Tracked credit consume ${consumeIdempotencyKey} lost its plan hold`,
				);
			}

			let refundablePlanCredits = requestedRefundSplit.plan;
			let holdPoolRemaining: number | null = null;

			if (planHold) {
				this.assertPlanHoldMatches(
					planHold,
					userId,
					consumeIdempotencyKey,
					consumedSplit.plan,
				);
				refundablePlanCredits = Math.min(
					refundablePlanCredits,
					planHold.refundableCredits,
				);

				if (planHold.poolId) {
					const [pool] = await this.creditsRepository.findPlanHoldPools(
						[planHold.poolId],
						tx,
					);

					if (!pool || pool.userId !== userId || pool.closedAt !== null) {
						throw new Error(
							`Credit plan hold ${consumeIdempotencyKey} references an invalid carry pool`,
						);
					}

					holdPoolRemaining = pool.remainingCredits;
					refundablePlanCredits = Math.min(
						refundablePlanCredits,
						pool.remainingCredits,
					);
				}
			}

			const refundSplit: CreditBucketSplit = {
				...requestedRefundSplit,
				plan: refundablePlanCredits,
			};
			const grantedAmount = CREDIT_SPEND_ORDER.reduce(
				(total, bucket) => total + refundSplit[bucket],
				0,
			);
			const forfeitedPlanCredits = requestedRefundSplit.plan - refundSplit.plan;
			const rows: CreditLedgerRow[] = [];

			for (const bucket of CREDIT_SPEND_ORDER) {
				const bucketAmount = refundSplit[bucket];

				if (bucketAmount === 0) {
					continue;
				}

				const row = await this.creditsRepository.insertLedgerEntry(
					{
						bucket,
						delta: bucketAmount,
						idempotencyKey: `${options.idempotencyKey}:${bucket}`,
						kind: "grant",
						meta: this.withReason(
							{
								...(options.meta ?? {}),
								idempotencyFingerprint: {
									amount: options.amount,
									consumeIdempotencyKey,
									forfeitedPlanCredits,
									grantedAmount,
									refundSplit,
									userId,
								},
							},
							"generation_settlement_refund",
						),
						userId,
					},
					tx,
				);

				this.assertRefundReplayMatches(
					row,
					userId,
					consumeIdempotencyKey,
					options,
					refundSplit,
				);
				rows.push(row);
			}

			if (planHold && refundSplit.plan > 0) {
				const updatedHold =
					await this.creditsRepository.updatePlanHoldRefundable(
						consumeIdempotencyKey,
						userId,
						planHold.refundableCredits,
						planHold.refundableCredits - refundSplit.plan,
						tx,
					);

				if (!updatedHold) {
					throw new Error(
						`Credit plan hold ${consumeIdempotencyKey} lost its refund transition`,
					);
				}

				if (planHold.poolId && holdPoolRemaining !== null) {
					const updatedPool =
						await this.creditsRepository.updatePlanHoldPoolRemaining(
							planHold.poolId,
							userId,
							holdPoolRemaining,
							holdPoolRemaining - refundSplit.plan,
							tx,
						);

					if (!updatedPool) {
						throw new Error(
							`Credit plan hold pool ${planHold.poolId} lost its refund transition`,
						);
					}
				}
			}

			return rows;
		};

		return this.creditsRepository.withUserLock(
			this.refundOperationLockKey(options.idempotencyKey),
			(tx) => this.creditsRepository.withUserLock(userId, refund, tx),
			transaction,
		);
	}

	async markPlanHoldInactive(
		userId: string,
		consumeIdempotencyKey: string,
		transaction?: CreditsTransaction,
	): Promise<void> {
		await this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				const hold = await this.creditsRepository.findPlanHold(
					consumeIdempotencyKey,
					tx,
				);

				if (!hold) {
					return;
				}

				if (hold.userId !== userId) {
					throw new Error(
						`Credit plan hold ${consumeIdempotencyKey} belongs to another user`,
					);
				}

				await this.creditsRepository.markPlanHoldInactive(
					consumeIdempotencyKey,
					userId,
					tx,
				);
			},
			transaction,
		);
	}

	async closePlanHold(
		userId: string,
		consumeIdempotencyKey: string,
		transaction?: CreditsTransaction,
	): Promise<void> {
		await this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				const hold = await this.creditsRepository.findPlanHold(
					consumeIdempotencyKey,
					tx,
				);

				if (!hold) {
					return;
				}

				if (hold.userId !== userId) {
					throw new Error(
						`Credit plan hold ${consumeIdempotencyKey} belongs to another user`,
					);
				}

				await this.creditsRepository.closePlanHold(
					consumeIdempotencyKey,
					userId,
					tx,
				);
			},
			transaction,
		);
	}

	async grant(
		userId: string,
		amount: number,
		options: GrantCreditOptions,
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		const result = await this.grantWithReplayStatus(
			userId,
			amount,
			options,
			transaction,
		);

		return result.row;
	}

	async grantWithReplayStatus(
		userId: string,
		amount: number,
		options: GrantCreditOptions,
		transaction?: CreditsTransaction,
	): Promise<GrantCreditResult> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				if (options.idempotencyKey) {
					const existing = await this.creditsRepository.findByIdempotencyKey(
						options.idempotencyKey,
						tx,
					);

					if (existing) {
						this.assertGrantReplayMatches(
							existing,
							userId,
							amount,
							options.bucket,
						);

						return { replayed: true, row: existing };
					}
				}

				const row = await this.creditsRepository.insertLedgerEntry(
					{
						bucket: options.bucket,
						delta: amount,
						idempotencyKey: options.idempotencyKey,
						kind: "grant",
						meta: this.withGrantFingerprint(options.meta, userId, amount),
						userId,
					},
					tx,
				);

				// A globally reused key can race across two different user locks. The
				// repository returns the winning row after ON CONFLICT; verify it before
				// treating that conflict as a successful replay.
				this.assertGrantReplayMatches(row, userId, amount, options.bucket);

				return { replayed: false, row };
			},
			transaction,
		);
	}

	/**
	 * Apply one rollover-capped plan refill under the user's advisory lock.
	 *
	 * The pre-refill snapshot, excess expiration, and grant share one database
	 * transaction. The grant key is the durable completion marker: a replay
	 * never takes a new balance snapshot after the refill has already landed.
	 */
	async applyCappedRefill(
		userId: string,
		allotment: number,
		options: CappedRefillOptions,
		transaction?: CreditsTransaction,
	): Promise<CappedRefillResult> {
		this.assertPositiveCreditAmount(allotment);

		const capMultiplier = options.capMultiplier ?? 1;

		if (!Number.isFinite(capMultiplier) || capMultiplier < 0) {
			throw new BadRequestException(
				"Credit refill cap multiplier must be a non-negative number",
			);
		}

		return this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				const existingGrant = await this.creditsRepository.findByIdempotencyKey(
					options.idempotencyKey,
					tx,
				);

				if (existingGrant) {
					this.assertGrantReplayMatches(
						existingGrant,
						userId,
						allotment,
						"plan",
					);
					this.assertCappedRefillReplayMatches(
						existingGrant,
						allotment,
						capMultiplier,
					);

					return this.cappedRefillReplay(existingGrant);
				}

				const expireKey = `${options.idempotencyKey}:expire`;
				const existingExpiration =
					await this.creditsRepository.findByIdempotencyKey(expireKey, tx);

				if (
					existingExpiration &&
					(existingExpiration.userId !== userId ||
						existingExpiration.bucket !== "plan" ||
						existingExpiration.kind !== "expire" ||
						existingExpiration.delta >= 0)
				) {
					throw new Error(
						`Credit refill expiration idempotency replay conflict for key ${expireKey}`,
					);
				}

				const balance = await this.creditsRepository.getBalance(userId, tx);
				const previouslyExpired = existingExpiration
					? Math.abs(existingExpiration.delta)
					: 0;
				const planHolds = await this.creditsRepository.listRefundablePlanHolds(
					userId,
					tx,
				);
				const oldPoolIds = [
					...new Set(
						planHolds.flatMap((hold) => (hold.poolId ? [hold.poolId] : [])),
					),
				];
				const holdPools = await this.creditsRepository.findPlanHoldPools(
					oldPoolIds,
					tx,
				);
				const poolById = new Map(holdPools.map((pool) => [pool.id, pool]));
				const pooledActiveCredits = new Map<string, number>();
				let unpooledActiveCredits = 0;

				for (const hold of planHolds) {
					if (!hold.active) {
						continue;
					}

					if (!hold.poolId) {
						unpooledActiveCredits += hold.refundableCredits;
						continue;
					}

					pooledActiveCredits.set(
						hold.poolId,
						(pooledActiveCredits.get(hold.poolId) ?? 0) +
							hold.refundableCredits,
					);
				}

				let activeHeldPlanCredits = unpooledActiveCredits;

				for (const [poolId, memberCredits] of pooledActiveCredits) {
					const pool = poolById.get(poolId);

					if (!pool || pool.userId !== userId || pool.closedAt !== null) {
						throw new Error(
							`Credit plan hold pool ${poolId} is invalid at refill`,
						);
					}

					activeHeldPlanCredits += Math.min(
						memberCredits,
						pool.remainingCredits,
					);
				}

				const ledgerPlanBalance = Math.max(balance.plan + previouslyExpired, 0);
				const preRefillPlanBalance = ledgerPlanBalance + activeHeldPlanCredits;
				const cap = Math.floor(allotment * capMultiplier);
				const carriedCredits = Math.min(preRefillPlanBalance, cap);
				const carriedLedgerCredits = Math.min(ledgerPlanBalance, cap);
				const carriedHeldCredits = carriedCredits - carriedLedgerCredits;
				const expiredLedgerCredits = Math.max(
					0,
					ledgerPlanBalance - carriedLedgerCredits,
				);
				const expiredHeldCredits = Math.max(
					0,
					activeHeldPlanCredits - carriedHeldCredits,
				);
				const expiredCredits = expiredLedgerCredits + expiredHeldCredits;

				if (existingExpiration && previouslyExpired !== expiredLedgerCredits) {
					throw new Error(
						`Credit refill expiration replay conflict for key ${expireKey}`,
					);
				}

				if (expiredLedgerCredits > 0 && !existingExpiration) {
					await this.creditsRepository.insertLedgerEntry(
						{
							bucket: "plan",
							delta: -expiredLedgerCredits,
							idempotencyKey: expireKey,
							kind: "expire",
							meta: this.withReason(
								{
									...(options.meta ?? {}),
									refillIdempotencyKey: options.idempotencyKey,
								},
								"subscription_refill_rollover_expiration",
							),
							userId,
						},
						tx,
					);
				}

				let newPoolId: string | null = null;

				if (carriedHeldCredits > 0) {
					const pool = await this.creditsRepository.insertPlanHoldPool(
						{
							boundaryIdempotencyKey: options.idempotencyKey,
							remainingCredits: carriedHeldCredits,
							userId,
						},
						tx,
					);

					if (
						pool.userId !== userId ||
						pool.remainingCredits !== carriedHeldCredits ||
						pool.closedAt !== null
					) {
						throw new Error(
							`Credit plan hold pool replay conflict for key ${options.idempotencyKey}`,
						);
					}

					newPoolId = pool.id;
				}

				await this.creditsRepository.applyPlanHoldBoundary(
					userId,
					newPoolId,
					tx,
				);
				await this.creditsRepository.closePlanHoldPools(
					userId,
					oldPoolIds.filter((poolId) => poolId !== newPoolId),
					tx,
				);

				const grant = await this.creditsRepository.insertLedgerEntry(
					{
						bucket: "plan",
						delta: allotment,
						idempotencyKey: options.idempotencyKey,
						kind: "grant",
						meta: this.withGrantFingerprint(
							{
								...(options.meta ?? {}),
								refill: {
									allotment,
									capMultiplier,
									carriedCredits,
									carriedHeldCredits,
									carriedLedgerCredits,
									expiredCredits,
									expiredHeldCredits,
									expiredLedgerCredits,
									preRefillPlanBalance,
								},
							},
							userId,
							allotment,
						),
						userId,
					},
					tx,
				);
				this.assertGrantReplayMatches(grant, userId, allotment, "plan");

				return {
					carriedCredits,
					expiredCredits,
					grant,
					preRefillPlanBalance,
					replayed: false,
				};
			},
			transaction,
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
		transaction?: CreditsTransaction,
	): Promise<number> {
		return this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
				// A terminal subscription boundary invalidates both unresolved holds
				// and same-cycle reconciliation rights before any delayed refund can
				// reintroduce subscription-funded credits.
				await this.creditsRepository.forfeitAllPlanHolds(userId, tx);

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
			},
			transaction,
		);
	}

	async expireAmount(
		userId: string,
		amount: number,
		options: CreditWriteOptions = {},
		transaction?: CreditsTransaction,
	): Promise<number> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withUserLock(
			userId,
			async (tx) => {
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
			},
			transaction,
		);
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

	grantSignupCredits(
		userId: string,
		amount = SIGNUP_GRANT_CREDITS,
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		return this.grant(
			userId,
			amount,
			{
				bucket: "promo",
				idempotencyKey: `signup:${userId}`,
				meta: { reason: "signup_grant" },
			},
			transaction,
		);
	}

	private async findExistingConsumeRows(
		options: CreditWriteOptions,
		tx: CreditsTransaction,
	) {
		if (!options.idempotencyKey) {
			return [];
		}

		const idempotencyKey = options.idempotencyKey;

		const rows = await Promise.all(
			CREDIT_SPEND_ORDER.map((bucket) =>
				this.creditsRepository.findByIdempotencyKey(
					this.consumeIdempotencyKey(idempotencyKey, bucket),
					tx,
				),
			),
		);

		return rows.filter((row): row is CreditLedgerRow => row !== null);
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

	private consumeOperationLockKey(idempotencyKey: string) {
		return `credit-consume-idempotency:${idempotencyKey}`;
	}

	private refundOperationLockKey(idempotencyKey: string) {
		return `credit-refund-idempotency:${idempotencyKey}`;
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

	private withGrantFingerprint(
		meta: CreditMeta | undefined,
		userId: string,
		amount: number,
	) {
		return {
			...this.withReason(meta, "grant"),
			idempotencyFingerprint: { amount, userId },
		};
	}

	private cappedRefillReplay(grant: CreditLedgerRow): CappedRefillResult {
		const meta = this.isRecord(grant.meta) ? grant.meta : null;
		const refill = this.isRecord(meta?.refill) ? meta.refill : null;
		const carriedCredits = this.integer(refill?.carriedCredits) ?? 0;
		const expiredCredits = this.nonNegativeInteger(refill?.expiredCredits) ?? 0;
		const preRefillPlanBalance =
			this.integer(refill?.preRefillPlanBalance) ??
			carriedCredits + expiredCredits;

		return {
			carriedCredits,
			expiredCredits,
			grant,
			preRefillPlanBalance,
			replayed: true,
		};
	}

	private nonNegativeInteger(value: unknown): number | null {
		return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
	}

	private integer(value: unknown): number | null {
		return Number.isInteger(value) ? Number(value) : null;
	}

	private async ensurePlanHold(
		rows: CreditLedgerRow[],
		userId: string,
		consumeIdempotencyKey: string | undefined,
		mode: "active" | "inactive" | undefined,
		tx: CreditsTransaction,
	): Promise<void> {
		if (!mode) {
			return;
		}

		if (!consumeIdempotencyKey) {
			throw new Error("Tracked plan hold lost its consume idempotency key");
		}

		const planRow = rows.find(
			(row) => row.bucket === "plan" && row.kind === "consume" && row.delta < 0,
		);

		if (!planRow) {
			return;
		}

		const originalCredits = Math.abs(planRow.delta);
		const hold = await this.creditsRepository.insertPlanHold(
			{
				active: mode === "active",
				consumeIdempotencyKey,
				consumeLedgerId: planRow.id,
				originalCredits,
				userId,
			},
			tx,
		);

		this.assertPlanHoldMatches(
			hold,
			userId,
			consumeIdempotencyKey,
			originalCredits,
		);

		if (
			hold.active !== (mode === "active") ||
			hold.refundableCredits !== originalCredits ||
			hold.poolId !== null
		) {
			throw new Error(
				`Credit plan hold replay conflict for key ${consumeIdempotencyKey}`,
			);
		}
	}

	private async assertPlanHoldReplayMatches(
		rows: CreditLedgerRow[],
		userId: string,
		consumeIdempotencyKey: string | undefined,
		mode: "active" | "inactive" | undefined,
		tx: CreditsTransaction,
	): Promise<void> {
		if (!mode) {
			return;
		}

		if (!consumeIdempotencyKey) {
			throw new Error("Tracked plan hold lost its consume idempotency key");
		}

		const planRow = rows.find(
			(row) => row.bucket === "plan" && row.kind === "consume" && row.delta < 0,
		);

		if (!planRow) {
			return;
		}

		const hold = await this.creditsRepository.findPlanHold(
			consumeIdempotencyKey,
			tx,
		);

		if (!hold) {
			throw new Error(
				`Tracked credit consume ${consumeIdempotencyKey} lost its plan hold`,
			);
		}

		this.assertPlanHoldMatches(
			hold,
			userId,
			consumeIdempotencyKey,
			Math.abs(planRow.delta),
		);
	}

	private assertPlanHoldMatches(
		hold: CreditPlanHoldRow,
		userId: string,
		consumeIdempotencyKey: string,
		originalCredits: number,
	): void {
		if (
			hold.userId !== userId ||
			hold.consumeIdempotencyKey !== consumeIdempotencyKey ||
			hold.originalCredits !== originalCredits ||
			hold.refundableCredits < 0 ||
			hold.refundableCredits > originalCredits
		) {
			throw new Error(
				`Credit plan hold replay conflict for key ${consumeIdempotencyKey}`,
			);
		}
	}

	private readPlanHoldMode(value: unknown): "active" | "inactive" | null {
		return value === "active" || value === "inactive" ? value : null;
	}

	private planHoldFingerprintMatches(
		value: unknown,
		expected: "active" | "inactive" | null,
	): boolean {
		return expected === null
			? value === null || value === undefined
			: value === expected;
	}

	private withConsumeFingerprint(
		meta: CreditMeta | undefined,
		userId: string,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		bucketSplit: CreditBucketSplit,
		planHold: "active" | "inactive" | null,
	) {
		return {
			...this.withReason(meta, "consume"),
			idempotencyFingerprint: {
				action,
				allowOverdraft,
				amount,
				bucketSplit,
				planHold,
				userId,
			},
		};
	}

	private buildConsumeBucketSplit(
		balance: CreditBucketSplit,
		amount: number,
		allowOverdraft: boolean,
	): CreditBucketSplit {
		const bucketSplit: CreditBucketSplit = {
			plan: 0,
			promo: 0,
			topup: 0,
		};
		let remaining = amount;

		for (const bucket of CREDIT_SPEND_ORDER) {
			bucketSplit[bucket] = Math.min(Math.max(balance[bucket], 0), remaining);
			remaining -= bucketSplit[bucket];
		}

		// Settlement debt lives in the last spend bucket. Keeping it out of plan
		// prevents an overage from corrupting subscription rollover snapshots.
		if (allowOverdraft && remaining > 0) {
			bucketSplit.topup += remaining;
		}

		return bucketSplit;
	}

	private buildRefundBucketSplit(
		consumedSplit: CreditBucketSplit,
		amount: number,
	): CreditBucketSplit {
		const refundSplit: CreditBucketSplit = {
			plan: 0,
			promo: 0,
			topup: 0,
		};
		let remaining = amount;

		for (const bucket of [...CREDIT_SPEND_ORDER].reverse()) {
			refundSplit[bucket] = Math.min(consumedSplit[bucket], remaining);
			remaining -= refundSplit[bucket];
		}

		if (remaining !== 0) {
			throw new Error("Credit refund bucket split does not cover its amount");
		}

		return refundSplit;
	}

	private consumeAction(meta: CreditMeta | undefined): string | null {
		return typeof meta?.action === "string" ? meta.action : null;
	}

	private assertConsumeReplayMatches(
		rows: CreditLedgerRow[],
		userId: string,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		planHold: "active" | "inactive" | null,
		idempotencyKey: string | undefined,
	): void {
		const firstFingerprint = this.consumeFingerprint(rows[0]);
		const bucketSplit = this.readBucketSplit(firstFingerprint?.bucketSplit);

		if (
			firstFingerprint === null ||
			firstFingerprint.userId !== userId ||
			firstFingerprint.amount !== amount ||
			firstFingerprint.action !== action ||
			(firstFingerprint.allowOverdraft === true) !== allowOverdraft ||
			!this.planHoldFingerprintMatches(firstFingerprint.planHold, planHold) ||
			bucketSplit === null ||
			CREDIT_SPEND_ORDER.reduce(
				(total, bucket) => total + bucketSplit[bucket],
				0,
			) !== amount
		) {
			throw new Error(
				`Credit consume idempotency replay conflict for key ${idempotencyKey ?? "<missing>"}`,
			);
		}

		const expectedBuckets = CREDIT_SPEND_ORDER.filter(
			(bucket) => bucketSplit[bucket] > 0,
		);
		const rowsMatch =
			idempotencyKey !== undefined &&
			rows.length === expectedBuckets.length &&
			expectedBuckets.every((bucket) => {
				const row = rows.find(
					(candidate) =>
						candidate.idempotencyKey ===
						this.consumeIdempotencyKey(idempotencyKey, bucket),
				);

				return (
					row !== undefined &&
					row.userId === userId &&
					row.kind === "consume" &&
					row.bucket === bucket &&
					row.delta === -bucketSplit[bucket] &&
					this.consumeFingerprintMatches(
						row,
						userId,
						amount,
						action,
						allowOverdraft,
						bucketSplit,
						planHold,
					)
				);
			});

		if (!rowsMatch) {
			throw new Error(
				`Credit consume idempotency replay conflict for key ${idempotencyKey ?? "<missing>"}`,
			);
		}
	}

	private consumeFingerprint(row: CreditLedgerRow | undefined) {
		const meta = this.isRecord(row?.meta) ? row.meta : null;

		return this.isRecord(meta?.idempotencyFingerprint)
			? meta.idempotencyFingerprint
			: null;
	}

	private consumeFingerprintMatches(
		row: CreditLedgerRow,
		userId: string,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		bucketSplit: CreditBucketSplit,
		planHold: "active" | "inactive" | null,
	) {
		const fingerprint = this.consumeFingerprint(row);
		const rowBucketSplit = this.readBucketSplit(fingerprint?.bucketSplit);

		return (
			fingerprint !== null &&
			fingerprint.userId === userId &&
			fingerprint.amount === amount &&
			fingerprint.action === action &&
			(fingerprint.allowOverdraft === true) === allowOverdraft &&
			this.planHoldFingerprintMatches(fingerprint.planHold, planHold) &&
			rowBucketSplit !== null &&
			CREDIT_SPEND_ORDER.every(
				(bucket) => rowBucketSplit[bucket] === bucketSplit[bucket],
			)
		);
	}

	private assertRefundReplaySetMatches(
		rows: CreditLedgerRow[],
		userId: string,
		consumeIdempotencyKey: string,
		options: RefundConsumeAmountOptions,
	): CreditLedgerRow[] {
		const firstMeta = this.isRecord(rows[0]?.meta) ? rows[0]?.meta : null;
		const firstFingerprint = this.isRecord(firstMeta?.idempotencyFingerprint)
			? firstMeta.idempotencyFingerprint
			: null;
		const refundSplit = this.readBucketSplit(firstFingerprint?.refundSplit);

		if (!refundSplit) {
			throw new Error(
				`Credit refund idempotency replay conflict for key ${options.idempotencyKey}`,
			);
		}

		const expectedBuckets = CREDIT_SPEND_ORDER.filter(
			(bucket) => refundSplit[bucket] > 0,
		);
		const orderedRows = expectedBuckets.map((bucket) =>
			rows.find(
				(row) => row.idempotencyKey === `${options.idempotencyKey}:${bucket}`,
			),
		);

		if (
			rows.length !== expectedBuckets.length ||
			orderedRows.some((row) => row === undefined)
		) {
			throw new Error(
				`Credit refund idempotency replay conflict for key ${options.idempotencyKey}`,
			);
		}

		for (const row of orderedRows) {
			if (!row) {
				throw new Error(
					`Credit refund idempotency replay conflict for key ${options.idempotencyKey}`,
				);
			}

			this.assertRefundReplayMatches(
				row,
				userId,
				consumeIdempotencyKey,
				options,
				refundSplit,
			);
		}

		return orderedRows as CreditLedgerRow[];
	}

	private assertRefundReplayMatches(
		row: CreditLedgerRow,
		userId: string,
		consumeIdempotencyKey: string,
		options: RefundConsumeAmountOptions,
		refundSplit: CreditBucketSplit,
	): void {
		const meta = this.isRecord(row.meta) ? row.meta : null;
		const fingerprint = this.isRecord(meta?.idempotencyFingerprint)
			? meta.idempotencyFingerprint
			: null;
		const rowSplit = this.readBucketSplit(fingerprint?.refundSplit);
		const expectedAmount = refundSplit[row.bucket];
		const grantedAmount = CREDIT_SPEND_ORDER.reduce(
			(total, bucket) => total + refundSplit[bucket],
			0,
		);

		if (
			row.userId !== userId ||
			row.kind !== "grant" ||
			row.delta !== expectedAmount ||
			row.idempotencyKey !== `${options.idempotencyKey}:${row.bucket}` ||
			fingerprint?.userId !== userId ||
			fingerprint?.amount !== options.amount ||
			fingerprint?.consumeIdempotencyKey !== consumeIdempotencyKey ||
			fingerprint?.grantedAmount !== grantedAmount ||
			!Number.isInteger(fingerprint?.forfeitedPlanCredits) ||
			Number(fingerprint?.forfeitedPlanCredits) < 0 ||
			rowSplit === null ||
			CREDIT_SPEND_ORDER.some(
				(bucket) => rowSplit[bucket] !== refundSplit[bucket],
			)
		) {
			throw new Error(
				`Credit refund idempotency replay conflict for key ${options.idempotencyKey}`,
			);
		}
	}

	private readBucketSplit(value: unknown): CreditBucketSplit | null {
		if (!this.isRecord(value)) {
			return null;
		}

		const keys = Object.keys(value);
		const isFullSplit =
			keys.length === CREDIT_SPEND_ORDER.length &&
			CREDIT_SPEND_ORDER.every(
				(bucket) =>
					Object.hasOwn(value, bucket) &&
					Number.isInteger(value[bucket]) &&
					Number(value[bucket]) >= 0,
			);

		if (!isFullSplit) {
			return null;
		}

		return {
			plan: Number(value.plan),
			promo: Number(value.promo),
			topup: Number(value.topup),
		};
	}

	private assertGrantReplayMatches(
		row: CreditLedgerRow,
		userId: string,
		amount: number,
		bucket: CreditBucket,
	): void {
		const meta = this.isRecord(row.meta) ? row.meta : null;
		const fingerprint = this.isRecord(meta?.idempotencyFingerprint)
			? meta.idempotencyFingerprint
			: null;
		const fingerprintMatches =
			fingerprint !== null &&
			fingerprint.userId === userId &&
			fingerprint.amount === amount;

		if (
			row.userId !== userId ||
			row.delta !== amount ||
			row.kind !== "grant" ||
			row.bucket !== bucket ||
			!fingerprintMatches
		) {
			throw new Error(
				`Credit grant idempotency replay conflict for key ${row.idempotencyKey ?? "<missing>"}`,
			);
		}
	}

	private assertCappedRefillReplayMatches(
		row: CreditLedgerRow,
		allotment: number,
		capMultiplier: number,
	): void {
		const meta = this.isRecord(row.meta) ? row.meta : null;
		const refill = this.isRecord(meta?.refill) ? meta.refill : null;
		const preRefillPlanBalance = this.integer(refill?.preRefillPlanBalance);
		const carriedCredits = this.integer(refill?.carriedCredits);
		const expiredCredits = this.nonNegativeInteger(refill?.expiredCredits);
		const expectedCap = Math.floor(allotment * capMultiplier);
		const expectedCarry =
			preRefillPlanBalance === null
				? null
				: Math.min(preRefillPlanBalance, expectedCap);

		if (
			refill?.allotment !== allotment ||
			refill?.capMultiplier !== capMultiplier ||
			preRefillPlanBalance === null ||
			carriedCredits === null ||
			expiredCredits === null ||
			carriedCredits !== expectedCarry ||
			expiredCredits !== Math.max(0, preRefillPlanBalance - carriedCredits)
		) {
			throw new Error(
				`Credit capped-refill replay conflict for key ${row.idempotencyKey ?? "<missing>"}`,
			);
		}
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}

	private assertPositiveCreditAmount(amount: number) {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new BadRequestException("Credit amount must be a positive integer");
		}
	}
}
