import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	CREDIT_SPEND_ORDER,
	type CreditActivityQuery,
	type CreditBucket,
	type CreditLedgerQuery,
	SIGNUP_GRANT_CREDITS,
} from "@wandit/contracts";

import {
	type CreditOwner,
	ownerColumns,
	userOwner,
} from "../../domain/credit-owner";
import { InsufficientCreditsError } from "../../domain/errors/insufficient-credits.error";
import {
	type CreditBalance,
	type CreditLedgerRow,
	type CreditPlanHoldPoolRow,
	type CreditPlanHoldRow,
	CreditsRepository,
	type CreditsTransaction,
	type SettledBalanceSnapshot,
} from "../../infrastructure/persistence/credits.repository";

type CreditMeta = Record<string, unknown> & {
	reason?: unknown;
};

/**
 * How deep concurrent reserve holds may drive the RAW ledger balance before
 * new "requirePositiveBalance" admissions refuse. Settled-view admission
 * ignores in-flight holds (so one running build never locks its owner out),
 * which needs a raw-side cap or a near-zero wallet could fan out unbounded
 * parallel reserves. 20 credits covers a page build plus its media children
 * plus concurrent chat with headroom. This bounds only the stacked RESERVES:
 * each admitted run can still settle above its reserve through allowOverdraft
 * up to its per-event sanity ceiling, so the true exposure tail is bounded by
 * the ceilings in the operation registry, not by this floor.
 */
const RESERVE_STACKING_FLOOR_CENTI_CREDITS = -2000;

type CreditWriteOptions = {
	/**
	 * Ruling 5 admission: any POSITIVE settled balance admits the full amount
	 * (the remainder overdrafts into topup); a zero-or-negative settled
	 * balance refuses, as does a raw balance below the stacking floor.
	 * Metering reserves use this so a run can start on 1 cc, a running hold
	 * never locks its owner out, and nothing new starts once the wallet is
	 * truly spent.
	 */
	admission?: "requirePositiveBalance";
	/** Metering-only escape hatch for post-provider settlement debt. */
	allowOverdraft?: boolean;
	/**
	 * The acting member for ORG consumption rows (ledger provenance). Ignored
	 * for personal owners — their rows already carry the user.
	 */
	actorUserId?: string;
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

/**
 * UNIT: integer centi-credits, like CreditBalance. settledBalance and the
 * settled* buckets have the in-flight reserve holds added back: what the
 * balance will read once running generations settle at estimated-or-lower
 * cost.
 */
export type SettledCreditBalance = SettledBalanceSnapshot;

@Injectable()
export class CreditsService {
	constructor(
		@Inject(CreditsRepository)
		private readonly creditsRepository: CreditsRepository,
	) {}

	/** Internal balance in integer centi-credits; callers convert for the API. */
	getBalance(owner: CreditOwner): Promise<CreditBalance> {
		return this.creditsRepository.getBalance(owner);
	}

	/** Net lifetime consumption for a personal owner, in centi-credits. */
	netConsumedCentiCredits(
		userId: string,
		transaction?: CreditsTransaction,
	): Promise<number> {
		return this.creditsRepository.netConsumedCentiCredits(userId, transaction);
	}

	/**
	 * Balance plus the reserved add-back, all integer centi-credits. While a
	 * usage event stays reserved its ledger dip equals its reserved_credits, so
	 * the sum restores exactly what settlement will return at worst.
	 */
	async getSettledBalance(owner: CreditOwner): Promise<SettledCreditBalance> {
		// One SQL statement = one snapshot under READ COMMITTED: the balance and
		// the reserved add-back can never straddle a concurrent settle.
		return this.creditsRepository.getSettledBalanceSnapshot(owner);
	}

	listLedger(owner: CreditOwner, query: CreditLedgerQuery) {
		return this.creditsRepository.listByOwner(owner, query);
	}

	/** One row per operation plus the non-usage ledger rows; see the repository. */
	listActivity(owner: CreditOwner, query: CreditActivityQuery) {
		return this.creditsRepository.listActivityByOwner(owner, query);
	}

	/** All amounts on this service are INTEGER CENTI-CREDITS (1 = 0.01 credit). */
	async consume(
		owner: CreditOwner,
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
					owner,
					amount,
					action,
					options.allowOverdraft === true,
					options.admission ?? null,
					options.planHold ?? null,
					options.idempotencyKey,
				);
				await this.assertPlanHoldReplayMatches(
					existingRows,
					owner,
					options.idempotencyKey,
					options.planHold,
					tx,
				);

				return existingRows;
			}

			const balance = await this.creditsRepository.getSettledBalanceSnapshot(
				owner,
				tx,
			);

			if (options.admission === "requirePositiveBalance") {
				// Ruling 5 admission on the SETTLED view: a positive settled balance
				// admits the spend even while reserve holds dip the raw ledger
				// negative — a running build must never lock its owner out of chat,
				// and the refusal threshold matches the number the header pill
				// shows. The raw balance still bounds how deep concurrent holds may
				// stack, so a near-zero wallet cannot fan out unbounded parallel
				// reserves.
				if (
					balance.settledBalance <= 0 ||
					balance.balance <= RESERVE_STACKING_FLOOR_CENTI_CREDITS
				) {
					throw new InsufficientCreditsError(
						amount,
						balance.balance,
						balance.settledBalance,
					);
				}
			} else if (!options.allowOverdraft && balance.balance < amount) {
				// Strict-cover refusal on the raw balance: report the raw number
				// too, or the error could claim more available than required while
				// refusing (settled adds running holds back).
				throw new InsufficientCreditsError(amount, balance.balance);
			}

			const bucketSplit = this.buildConsumeBucketSplit(
				balance,
				amount,
				options.allowOverdraft === true ||
					options.admission === "requirePositiveBalance",
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
								owner,
								options.actorUserId ?? null,
								amount,
								action,
								options.allowOverdraft === true,
								options.admission ?? null,
								bucketSplit,
								options.planHold ?? null,
							),
							...this.consumeRowColumns(owner, options.actorUserId ?? null),
						},
						tx,
					),
				);
			}

			if (options.idempotencyKey) {
				this.assertConsumeReplayMatches(
					rows,
					owner,
					amount,
					action,
					options.allowOverdraft === true,
					options.admission ?? null,
					options.planHold ?? null,
					options.idempotencyKey,
				);
			}

			await this.ensurePlanHold(
				rows,
				owner,
				options.idempotencyKey,
				options.planHold,
				tx,
			);

			return rows;
		};

		if (!options.idempotencyKey) {
			return this.creditsRepository.withOwnerLock(owner, consume, transaction);
		}

		// A ledger key is global while the normal balance lock is per owner. Take
		// the operation lock first so two owners cannot race disjoint bucket rows
		// under the same base key.
		return this.creditsRepository.withLockValue(
			this.consumeOperationLockKey(options.idempotencyKey),
			(tx) => this.creditsRepository.withOwnerLock(owner, consume, tx),
			transaction,
		);
	}

	/**
	 * Compensate an idempotent consume, preserving the original plan/top-up
	 * split. Replays return the same refund rows and never credit twice.
	 */
	async refundConsume(
		owner: CreditOwner,
		consumeIdempotencyKey: string,
		meta: CreditMeta = {},
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow[]> {
		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const consumedRows = await this.creditsRepository.findByIdempotencyKeys(
					owner,
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
								...ownerColumns(owner),
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
		owner: CreditOwner,
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
				owner,
				fingerprintAmount,
				fingerprintAction,
				fingerprint?.allowOverdraft === true,
				this.readAdmissionMode(fingerprint?.admission),
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
				if (
					!this.rowOwnerMatches(row, owner) ||
					row.kind !== "consume" ||
					row.delta >= 0
				) {
					throw new Error(
						`Credit consume replay conflict for key ${consumeIdempotencyKey}`,
					);
				}

				consumedSplit[row.bucket] += Math.abs(row.delta);
			}

			const existingRefundRows =
				await this.creditsRepository.findByIdempotencyKeys(
					owner,
					CREDIT_SPEND_ORDER.map(
						(bucket) => `${options.idempotencyKey}:${bucket}`,
					),
					tx,
				);

			if (existingRefundRows.length > 0) {
				return this.assertRefundReplaySetMatches(
					existingRefundRows,
					owner,
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
					owner,
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

					if (
						!pool ||
						!this.poolOwnerMatches(pool, owner) ||
						pool.closedAt !== null
					) {
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
									...this.ownerFingerprintFields(owner, null),
								},
							},
							"generation_settlement_refund",
						),
						...ownerColumns(owner),
					},
					tx,
				);

				this.assertRefundReplayMatches(
					row,
					owner,
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
						owner,
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
							owner,
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

		return this.creditsRepository.withLockValue(
			this.refundOperationLockKey(options.idempotencyKey),
			(tx) => this.creditsRepository.withOwnerLock(owner, refund, tx),
			transaction,
		);
	}

	async markPlanHoldInactive(
		owner: CreditOwner,
		consumeIdempotencyKey: string,
		transaction?: CreditsTransaction,
	): Promise<void> {
		await this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const hold = await this.creditsRepository.findPlanHold(
					consumeIdempotencyKey,
					tx,
				);

				if (!hold) {
					return;
				}

				if (!this.holdOwnerMatches(hold, owner)) {
					throw new Error(
						`Credit plan hold ${consumeIdempotencyKey} belongs to another owner`,
					);
				}

				await this.creditsRepository.markPlanHoldInactive(
					consumeIdempotencyKey,
					owner,
					tx,
				);
			},
			transaction,
		);
	}

	async closePlanHold(
		owner: CreditOwner,
		consumeIdempotencyKey: string,
		transaction?: CreditsTransaction,
	): Promise<void> {
		await this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const hold = await this.creditsRepository.findPlanHold(
					consumeIdempotencyKey,
					tx,
				);

				if (!hold) {
					return;
				}

				if (!this.holdOwnerMatches(hold, owner)) {
					throw new Error(
						`Credit plan hold ${consumeIdempotencyKey} belongs to another owner`,
					);
				}

				await this.creditsRepository.closePlanHold(
					consumeIdempotencyKey,
					owner,
					tx,
				);
			},
			transaction,
		);
	}

	async grant(
		owner: CreditOwner,
		amount: number,
		options: GrantCreditOptions,
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		const result = await this.grantWithReplayStatus(
			owner,
			amount,
			options,
			transaction,
		);

		return result.row;
	}

	async grantWithReplayStatus(
		owner: CreditOwner,
		amount: number,
		options: GrantCreditOptions,
		transaction?: CreditsTransaction,
	): Promise<GrantCreditResult> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				if (options.idempotencyKey) {
					const existing = await this.creditsRepository.findByIdempotencyKey(
						options.idempotencyKey,
						tx,
					);

					if (existing) {
						this.assertGrantReplayMatches(
							existing,
							owner,
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
						meta: this.withGrantFingerprint(options.meta, owner, amount),
						...ownerColumns(owner),
					},
					tx,
				);

				// A globally reused key can race across two different owner locks. The
				// repository returns the winning row after ON CONFLICT; verify it before
				// treating that conflict as a successful replay.
				this.assertGrantReplayMatches(row, owner, amount, options.bucket);

				return { replayed: false, row };
			},
			transaction,
		);
	}

	/**
	 * Apply one rollover-capped plan refill under the owner's advisory lock.
	 *
	 * The pre-refill snapshot, excess expiration, and grant share one database
	 * transaction. The grant key is the durable completion marker: a replay
	 * never takes a new balance snapshot after the refill has already landed.
	 */
	async applyCappedRefill(
		owner: CreditOwner,
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

		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const existingGrant = await this.creditsRepository.findByIdempotencyKey(
					options.idempotencyKey,
					tx,
				);

				if (existingGrant) {
					this.assertGrantReplayMatches(
						existingGrant,
						owner,
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
					(!this.rowOwnerMatches(existingExpiration, owner) ||
						existingExpiration.bucket !== "plan" ||
						existingExpiration.kind !== "expire" ||
						existingExpiration.delta >= 0)
				) {
					throw new Error(
						`Credit refill expiration idempotency replay conflict for key ${expireKey}`,
					);
				}

				const balance = await this.creditsRepository.getBalance(owner, tx);
				const previouslyExpired = existingExpiration
					? Math.abs(existingExpiration.delta)
					: 0;
				const planHolds = await this.creditsRepository.listRefundablePlanHolds(
					owner,
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

					if (
						!pool ||
						!this.poolOwnerMatches(pool, owner) ||
						pool.closedAt !== null
					) {
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
							...ownerColumns(owner),
						},
						tx,
					);
				}

				let newPoolId: string | null = null;

				if (carriedHeldCredits > 0) {
					const pool = await this.creditsRepository.insertPlanHoldPool(
						{
							boundaryIdempotencyKey: options.idempotencyKey,
							owner,
							remainingCredits: carriedHeldCredits,
						},
						tx,
					);

					if (
						!this.poolOwnerMatches(pool, owner) ||
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
					owner,
					newPoolId,
					tx,
				);
				await this.creditsRepository.closePlanHoldPools(
					owner,
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
							owner,
							allotment,
						),
						...ownerColumns(owner),
					},
					tx,
				);
				this.assertGrantReplayMatches(grant, owner, allotment, "plan");

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

	/** amount is centi-credits: billing converts pack credits x100 before calling. */
	async topup(
		owner: CreditOwner,
		amount: number,
		options: CreditWriteOptions = {},
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const row = await this.creditsRepository.insertLedgerEntry(
					{
						bucket: "topup",
						delta: amount,
						idempotencyKey: options.idempotencyKey,
						kind: "topup",
						meta: this.withTopupFingerprint(options.meta, owner, amount),
						...ownerColumns(owner),
					},
					tx,
				);

				// The insert returns the WINNING row after ON CONFLICT: a replayed key
				// with a different amount or owner must conflict loudly, never silently
				// hand back the old row as if this request had been applied.
				if (options.idempotencyKey) {
					this.assertTopupReplayMatches(row, owner, amount);
				}

				return row;
			},
			transaction,
		);
	}

	async expirePlanRemainder(
		owner: CreditOwner,
		options: CreditWriteOptions = {},
		transaction?: CreditsTransaction,
	): Promise<number> {
		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				// A terminal subscription boundary invalidates both unresolved holds
				// and same-cycle reconciliation rights before any delayed refund can
				// reintroduce subscription-funded credits.
				await this.creditsRepository.forfeitAllPlanHolds(owner, tx);

				const existingAmount = await this.findExistingNegativeAmount(
					owner,
					options.idempotencyKey,
					tx,
				);

				if (existingAmount !== null) {
					return existingAmount;
				}

				const balance = await this.creditsRepository.getBalance(owner, tx);
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
						...ownerColumns(owner),
					},
					tx,
				);

				return amountToExpire;
			},
			transaction,
		);
	}

	async expireAmount(
		owner: CreditOwner,
		amount: number,
		options: CreditWriteOptions = {},
		transaction?: CreditsTransaction,
	): Promise<number> {
		this.assertPositiveCreditAmount(amount);

		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const existingAmount = await this.findExistingNegativeAmount(
					owner,
					options.idempotencyKey,
					tx,
				);

				if (existingAmount !== null) {
					return existingAmount;
				}

				const balance = await this.creditsRepository.getBalance(owner, tx);
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
						...ownerColumns(owner),
					},
					tx,
				);

				return amountToExpire;
			},
			transaction,
		);
	}

	async revoke(
		owner: CreditOwner,
		amount: number,
		options: RevokeCreditOptions = {},
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		this.assertPositiveCreditAmount(amount);

		// Preserve the existing top-up default for untouched callers.
		const bucket = options.bucket ?? "topup";

		return this.creditsRepository.withOwnerLock(
			owner,
			async (tx) => {
				const row = await this.creditsRepository.insertLedgerEntry(
					{
						bucket,
						delta: -amount,
						idempotencyKey: options.idempotencyKey,
						kind: "revoke",
						meta: this.withRevokeFingerprint(options.meta, owner, amount),
						...ownerColumns(owner),
					},
					tx,
				);

				// Same replay contract as topup: the returned row may belong to an
				// earlier write of this key and must match this request exactly.
				if (options.idempotencyKey) {
					this.assertRevokeReplayMatches(row, owner, amount, bucket);
				}

				return row;
			},
			transaction,
		);
	}

	grantSignupCredits(
		userId: string,
		// SIGNUP_GRANT_CREDITS is a whole-display-credit contract constant; the
		// ledger unit is centi-credits, so the default converts x100 here (the
		// only place). Explicit amounts (the signup outbox) already arrive in
		// centi-credits — product_settings stores centi-credits post-v4.
		amount = SIGNUP_GRANT_CREDITS * 100,
		transaction?: CreditsTransaction,
	): Promise<CreditLedgerRow> {
		return this.grant(
			userOwner(userId),
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
		owner: CreditOwner,
		idempotencyKey: string | undefined,
		tx: CreditsTransaction,
	) {
		if (!idempotencyKey) {
			return null;
		}

		const existing = await this.creditsRepository.findByIdempotencyKeys(
			owner,
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

	/**
	 * Fingerprint identity fields per owner type.
	 *
	 * COMPATIBILITY INVARIANT: personal fingerprints keep the exact pre-teams
	 * shape ({ userId } and nothing else) so replays of rows written before
	 * this deploy keep validating. Org fingerprints carry the pool identity
	 * plus the acting member (informational).
	 */
	private ownerFingerprintFields(
		owner: CreditOwner,
		actorUserId: string | null,
	): Record<string, unknown> {
		return owner.type === "user"
			? { userId: owner.userId }
			: {
					actorUserId,
					organizationId: owner.organizationId,
				};
	}

	/**
	 * Owner identity match against a fingerprint. Personal fingerprints must
	 * not carry an organizationId (an org row can never replay as personal);
	 * org matching ignores the recorded actor — the POOL is the identity.
	 */
	private fingerprintOwnerMatches(
		fingerprint: Record<string, unknown>,
		owner: CreditOwner,
	): boolean {
		return owner.type === "user"
			? fingerprint.userId === owner.userId &&
					fingerprint.organizationId === undefined
			: fingerprint.organizationId === owner.organizationId;
	}

	private rowOwnerMatches(row: CreditLedgerRow, owner: CreditOwner): boolean {
		return owner.type === "user"
			? row.userId === owner.userId && row.organizationId === null
			: row.organizationId === owner.organizationId;
	}

	private holdOwnerMatches(
		hold: CreditPlanHoldRow,
		owner: CreditOwner,
	): boolean {
		return owner.type === "user"
			? hold.userId === owner.userId && hold.organizationId === null
			: hold.organizationId === owner.organizationId;
	}

	private poolOwnerMatches(
		pool: CreditPlanHoldPoolRow,
		owner: CreditOwner,
	): boolean {
		return owner.type === "user"
			? pool.userId === owner.userId && pool.organizationId === null
			: pool.organizationId === owner.organizationId;
	}

	/** Ledger columns for a CONSUME row: org rows record the acting member. */
	private consumeRowColumns(
		owner: CreditOwner,
		actorUserId: string | null,
	): { organizationId: string | null; userId: string | null } {
		return owner.type === "user"
			? { organizationId: null, userId: owner.userId }
			: { organizationId: owner.organizationId, userId: actorUserId };
	}

	private withGrantFingerprint(
		meta: CreditMeta | undefined,
		owner: CreditOwner,
		amount: number,
	) {
		return {
			...this.withReason(meta, "grant"),
			idempotencyFingerprint: {
				amount,
				...this.ownerFingerprintFields(owner, null),
			},
		};
	}

	private withTopupFingerprint(
		meta: CreditMeta | undefined,
		owner: CreditOwner,
		amount: number,
	) {
		return {
			...this.withReason(meta, "topup"),
			idempotencyFingerprint: {
				amount,
				...this.ownerFingerprintFields(owner, null),
			},
		};
	}

	private withRevokeFingerprint(
		meta: CreditMeta | undefined,
		owner: CreditOwner,
		amount: number,
	) {
		return {
			...this.withReason(meta, "revoke"),
			idempotencyFingerprint: {
				amount,
				...this.ownerFingerprintFields(owner, null),
			},
		};
	}

	/**
	 * Rows written before this deploy lack the fingerprint — those validate on
	 * the row columns alone (they always exist); a present fingerprint must
	 * also match. Never reject for a missing fingerprint.
	 */
	private assertTopupReplayMatches(
		row: CreditLedgerRow,
		owner: CreditOwner,
		amount: number,
	): void {
		const fingerprint = this.consumeFingerprint(row);
		const fingerprintMatches =
			fingerprint === null ||
			(this.fingerprintOwnerMatches(fingerprint, owner) &&
				fingerprint.amount === amount);

		if (
			!this.rowOwnerMatches(row, owner) ||
			row.kind !== "topup" ||
			row.bucket !== "topup" ||
			row.delta !== amount ||
			!fingerprintMatches
		) {
			throw new Error(
				`Credit topup idempotency replay conflict for key ${row.idempotencyKey ?? "<missing>"}`,
			);
		}
	}

	private assertRevokeReplayMatches(
		row: CreditLedgerRow,
		owner: CreditOwner,
		amount: number,
		bucket: CreditBucket,
	): void {
		const fingerprint = this.consumeFingerprint(row);
		const fingerprintMatches =
			fingerprint === null ||
			(this.fingerprintOwnerMatches(fingerprint, owner) &&
				fingerprint.amount === amount);

		if (
			!this.rowOwnerMatches(row, owner) ||
			row.kind !== "revoke" ||
			row.bucket !== bucket ||
			row.delta !== -amount ||
			!fingerprintMatches
		) {
			throw new Error(
				`Credit revoke idempotency replay conflict for key ${row.idempotencyKey ?? "<missing>"}`,
			);
		}
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
		owner: CreditOwner,
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
				owner,
			},
			tx,
		);

		this.assertPlanHoldMatches(
			hold,
			owner,
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
		owner: CreditOwner,
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
			owner,
			consumeIdempotencyKey,
			Math.abs(planRow.delta),
		);
	}

	private assertPlanHoldMatches(
		hold: CreditPlanHoldRow,
		owner: CreditOwner,
		consumeIdempotencyKey: string,
		originalCredits: number,
	): void {
		if (
			!this.holdOwnerMatches(hold, owner) ||
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

	private readAdmissionMode(value: unknown): "requirePositiveBalance" | null {
		return value === "requirePositiveBalance" ? value : null;
	}

	/** Rows written before the admission field existed replay as legacy. */
	private admissionFingerprintMatches(
		value: unknown,
		expected: "requirePositiveBalance" | null,
	): boolean {
		return expected === null
			? value === null || value === undefined
			: value === expected;
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
		owner: CreditOwner,
		actorUserId: string | null,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		admission: "requirePositiveBalance" | null,
		bucketSplit: CreditBucketSplit,
		planHold: "active" | "inactive" | null,
	) {
		return {
			...this.withReason(meta, "consume"),
			idempotencyFingerprint: {
				action,
				admission,
				allowOverdraft,
				amount,
				bucketSplit,
				planHold,
				...this.ownerFingerprintFields(owner, actorUserId),
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
		owner: CreditOwner,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		admission: "requirePositiveBalance" | null,
		planHold: "active" | "inactive" | null,
		idempotencyKey: string | undefined,
	): void {
		const firstFingerprint = this.consumeFingerprint(rows[0]);
		const bucketSplit = this.readBucketSplit(firstFingerprint?.bucketSplit);

		if (
			firstFingerprint === null ||
			!this.fingerprintOwnerMatches(firstFingerprint, owner) ||
			firstFingerprint.amount !== amount ||
			firstFingerprint.action !== action ||
			(firstFingerprint.allowOverdraft === true) !== allowOverdraft ||
			!this.admissionFingerprintMatches(
				firstFingerprint.admission,
				admission,
			) ||
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
					this.rowOwnerMatches(row, owner) &&
					row.kind === "consume" &&
					row.bucket === bucket &&
					row.delta === -bucketSplit[bucket] &&
					this.consumeFingerprintMatches(
						row,
						owner,
						amount,
						action,
						allowOverdraft,
						admission,
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
		owner: CreditOwner,
		amount: number,
		action: string | null,
		allowOverdraft: boolean,
		admission: "requirePositiveBalance" | null,
		bucketSplit: CreditBucketSplit,
		planHold: "active" | "inactive" | null,
	) {
		const fingerprint = this.consumeFingerprint(row);
		const rowBucketSplit = this.readBucketSplit(fingerprint?.bucketSplit);

		return (
			fingerprint !== null &&
			this.fingerprintOwnerMatches(fingerprint, owner) &&
			fingerprint.amount === amount &&
			fingerprint.action === action &&
			(fingerprint.allowOverdraft === true) === allowOverdraft &&
			this.admissionFingerprintMatches(fingerprint.admission, admission) &&
			this.planHoldFingerprintMatches(fingerprint.planHold, planHold) &&
			rowBucketSplit !== null &&
			CREDIT_SPEND_ORDER.every(
				(bucket) => rowBucketSplit[bucket] === bucketSplit[bucket],
			)
		);
	}

	private assertRefundReplaySetMatches(
		rows: CreditLedgerRow[],
		owner: CreditOwner,
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
				owner,
				consumeIdempotencyKey,
				options,
				refundSplit,
			);
		}

		return orderedRows as CreditLedgerRow[];
	}

	private assertRefundReplayMatches(
		row: CreditLedgerRow,
		owner: CreditOwner,
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
			!this.rowOwnerMatches(row, owner) ||
			row.kind !== "grant" ||
			row.delta !== expectedAmount ||
			row.idempotencyKey !== `${options.idempotencyKey}:${row.bucket}` ||
			fingerprint === null ||
			!this.fingerprintOwnerMatches(fingerprint, owner) ||
			fingerprint.amount !== options.amount ||
			fingerprint.consumeIdempotencyKey !== consumeIdempotencyKey ||
			fingerprint.grantedAmount !== grantedAmount ||
			!Number.isInteger(fingerprint.forfeitedPlanCredits) ||
			Number(fingerprint.forfeitedPlanCredits) < 0 ||
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
		owner: CreditOwner,
		amount: number,
		bucket: CreditBucket,
	): void {
		const meta = this.isRecord(row.meta) ? row.meta : null;
		const fingerprint = this.isRecord(meta?.idempotencyFingerprint)
			? meta.idempotencyFingerprint
			: null;
		const fingerprintMatches =
			fingerprint !== null &&
			this.fingerprintOwnerMatches(fingerprint, owner) &&
			fingerprint.amount === amount;

		if (
			!this.rowOwnerMatches(row, owner) ||
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

	// Amounts are integer centi-credits: the minimum billable amount is
	// 1 centi-credit (0.01 credit). A caller that forgot the x100 conversion
	// still passes this guard, so every boundary must convert before calling.
	private assertPositiveCreditAmount(amount: number) {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new BadRequestException("Credit amount must be a positive integer");
		}
	}
}
