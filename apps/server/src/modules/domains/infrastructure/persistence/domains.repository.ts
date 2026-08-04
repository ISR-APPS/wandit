import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";
import type {
	DomainDns,
	DomainPriceSnapshot,
	DomainStatus,
	DomainTld,
	PaymentOrderStatus,
	Registrant,
} from "@wandit/contracts";
import { and, asc, desc, eq, inArray, or, sql } from "@wandit/db";
import { domains } from "@wandit/db/schema/domains";
import { paymentOrders } from "@wandit/db/schema/orders";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	DOMAIN_CONFIGURATION_MAX_ATTEMPT,
	type DomainConfigurationCursor,
	parseDomainConfigurationCursor,
} from "../../application/fulfillment/domain-fulfillment.contracts";
import {
	DomainAlreadyExistsError,
	InvalidDomainStateError,
} from "../../domain/errors/domain.errors";

export type DomainRow = typeof domains.$inferSelect;

export const DOMAIN_REPOSITORY_MAX_BATCH_SIZE = 100;

export type StaleDomainPurchaseCandidate = {
	domainId: string;
	domainStatus: DomainStatus;
	orderId: string;
	orderStatus: PaymentOrderStatus;
	updatedAt: Date;
};

export type StaleDomainConfigurationCandidate = {
	domainId: string;
	nonce: string;
	updatedAt: Date;
};

export type FindStaleDomainPurchaseCandidatesInput = {
	limit: number;
	staleBefore: Date;
};

export type FindStaleDomainConfigurationCandidatesInput = {
	limit: number;
	staleBefore: Date;
};

export type DomainTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type CreatePurchasedOrderDomainInput = {
	name: string;
	paymentOrderId: string;
	priceSnapshot: DomainPriceSnapshot;
	projectId: string | null;
	registrant: Registrant;
	tld: DomainTld;
	userId: string;
	whoisPrivacy: boolean;
};

type PurchasedDomainInsertInput = {
	name: string;
	paymentOrderId?: string;
	priceSnapshot: DomainPriceSnapshot;
	projectId: string | null;
	registrant: Registrant;
	tld: DomainTld;
	userId: string;
	whoisPrivacy?: boolean;
};

type CreateExternalDomainInput = {
	name: string;
	projectId: string;
	tld: string;
	userId: string;
};

type DomainUpdate = Partial<
	Pick<
		typeof domains.$inferInsert,
		| "autoRenew"
		| "cfCustomHostnameId"
		| "dns"
		| "error"
		| "expiresAt"
		| "isPrimary"
		| "priceSnapshot"
		| "projectId"
		| "provider"
		| "providerDomainId"
		| "providerOrderId"
		| "providerTotalPaidUsd"
		| "status"
		| "transferLockExpiresAt"
	>
>;

@Injectable()
export class DomainsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async assertProjectAccessible(
		scope: ProjectScope,
		projectId: string,
	): Promise<void> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					sql`${projects.deletedAt} IS NULL`,
				),
			)
			.limit(1);

		if (!project) {
			throw new NotFoundException("Project not found");
		}
	}

	async listByProject(projectId: string, scope: ProjectScope): Promise<DomainRow[]> {
		await this.assertProjectAccessible(scope, projectId);

		// Personal keeps the purchaser filter (byte-compat). Org projects list
		// every attached domain regardless of which member bought it — project
		// access is already proven above and mutations are role-gated.
		const purchaserFilter =
			scope.kind === "personal" ? [eq(domains.userId, scope.userId)] : [];

		return this.db
			.select()
			.from(domains)
			.where(and(eq(domains.projectId, projectId), ...purchaserFilter))
			.orderBy(desc(domains.createdAt), desc(domains.id));
	}

	/**
	 * Scope-aware access for PROJECT-side domain management (verify, primary,
	 * detach). Personal: purchaser equality, byte-compat. Org: the domain must
	 * be attached to a project of this org — which member bought it does not
	 * matter (asset-side ops like auto-renew stay purchaser-only elsewhere).
	 */
	async getByIdForScope(id: string, scope: ProjectScope): Promise<DomainRow> {
		if (scope.kind === "personal") {
			return this.getByIdForUser(id, scope.userId);
		}

		const [row] = await this.db
			.select({ domains })
			.from(domains)
			.innerJoin(
				projects,
				and(
					eq(projects.id, domains.projectId),
					projectScopePredicate(scope),
					sql`${projects.deletedAt} IS NULL`,
				),
			)
			.where(eq(domains.id, id))
			.limit(1);

		return this.expectRow(row?.domains);
	}

	async getByIdForUser(id: string, userId: string): Promise<DomainRow> {
		const [row] = await this.db
			.select()
			.from(domains)
			.where(and(eq(domains.id, id), eq(domains.userId, userId)))
			.limit(1);

		return this.expectRow(row);
	}

	async getById(id: string): Promise<DomainRow | null> {
		const [row] = await this.db
			.select()
			.from(domains)
			.where(eq(domains.id, id))
			.limit(1);

		return row ?? null;
	}

	async findByName(name: string): Promise<DomainRow | null> {
		const [row] = await this.db
			.select()
			.from(domains)
			.where(eq(domains.name, name))
			.limit(1);

		return row ?? null;
	}

	async findByPaymentOrderId(
		paymentOrderId: string,
	): Promise<DomainRow | null> {
		const [row] = await this.db
			.select()
			.from(domains)
			.where(eq(domains.paymentOrderId, paymentOrderId))
			.limit(1);

		return row ?? null;
	}

	async findStalePurchaseCandidates(
		input: FindStaleDomainPurchaseCandidatesInput,
	): Promise<StaleDomainPurchaseCandidate[]> {
		return this.db
			.select({
				domainId: domains.id,
				domainStatus: domains.status,
				orderId: paymentOrders.id,
				orderStatus: paymentOrders.status,
				updatedAt: domains.updatedAt,
			})
			.from(domains)
			.innerJoin(paymentOrders, eq(paymentOrders.id, domains.paymentOrderId))
			.where(
				and(
					sql`${domains.updatedAt} <= ${input.staleBefore}`,
					or(
						and(
							inArray(domains.status, ["registering", "configuring"]),
							inArray(paymentOrders.status, ["paid", "fulfilling"]),
						),
						and(
							eq(domains.status, "active"),
							eq(paymentOrders.status, "fulfilling"),
						),
					),
				),
			)
			.orderBy(asc(domains.updatedAt), asc(domains.id))
			.limit(boundedRepositoryLimit(input.limit));
	}

	async findStaleConfigurationCandidates(
		input: FindStaleDomainConfigurationCandidatesInput,
	): Promise<StaleDomainConfigurationCandidate[]> {
		const rows = await this.db
			.select({
				dns: domains.dns,
				domainId: domains.id,
				updatedAt: domains.updatedAt,
			})
			.from(domains)
			.where(
				and(
					sql`${domains.updatedAt} <= ${input.staleBefore}`,
					eq(domains.source, "external"),
					eq(domains.status, "configuring"),
					sql`${domains.cfCustomHostnameId} IS NOT NULL`,
					sql`COALESCE((${domains.dns} -> 'triggerConfiguration') @> jsonb_build_object('nextAttempt', ${DOMAIN_CONFIGURATION_MAX_ATTEMPT}::integer), false) = false`,
				),
			)
			.orderBy(asc(domains.updatedAt), asc(domains.id))
			.limit(boundedRepositoryLimit(input.limit));

		return rows.flatMap((row) => {
			const cursor = cursorFromDns(row.dns);

			if (cursor?.nextAttempt === DOMAIN_CONFIGURATION_MAX_ATTEMPT) {
				return [];
			}

			return [
				{
					domainId: row.domainId,
					nonce: cursor?.nonce ?? String(row.updatedAt.getTime()),
					updatedAt: row.updatedAt,
				},
			];
		});
	}

	async initializeCursor(
		domainId: string,
		input: { adoptExistingNonce: boolean; nonce: string },
	): Promise<DomainConfigurationCursor | null> {
		const result = await this.db.$client.query<{ dns: unknown }>(
			`UPDATE domains
			 SET dns = CASE
			   WHEN jsonb_typeof(
			     (CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END)
			       -> 'triggerConfiguration'
			   ) = 'object'
			   AND (
			     $3::boolean
			     OR (CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END)
			       -> 'triggerConfiguration' ->> 'nonce' = $2::text
			   )
			   THEN CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END
			   ELSE (CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END)
			     || jsonb_build_object(
			       'triggerConfiguration',
			       jsonb_build_object(
			         'nonce', $2::text,
			         'nextAttempt', 0,
			         'nextProbeAt', NULL
			       )
			     )
			 END,
			 updated_at = updated_at
			 WHERE id = $1::uuid
			   AND status = 'configuring'
			 RETURNING dns`,
			[domainId, input.nonce, input.adoptExistingNonce],
		);

		return cursorFromDns(result.rows[0]?.dns);
	}

	async readCursor(
		domainId: string,
	): Promise<DomainConfigurationCursor | null> {
		// Reads remain available after activation/failure so the runner can remove
		// the matching private cursor after the lifecycle CAS changes status.
		const result = await this.db.$client.query<{ dns: unknown }>(
			`SELECT dns
			 FROM domains
			 WHERE id = $1::uuid
			 LIMIT 1`,
			[domainId],
		);

		return cursorFromDns(result.rows[0]?.dns);
	}

	async advanceCursor(
		domainId: string,
		input: {
			expectedAttempt: number;
			nextAttempt: number;
			nextProbeAt: Date;
			nonce: string;
		},
	): Promise<boolean> {
		const nextProbeAt = input.nextProbeAt.toISOString();
		const persisted = parseDomainConfigurationCursor({
			nextAttempt: input.nextAttempt,
			nextProbeAt,
			nonce: input.nonce,
		});
		parseDomainConfigurationCursor({
			nextAttempt: input.expectedAttempt,
			nextProbeAt: null,
			nonce: input.nonce,
		});

		const result = await this.db.$client.query<{ id: string }>(
			`UPDATE domains
			 SET dns = (CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END)
			     || jsonb_build_object(
			       'triggerConfiguration',
			       jsonb_build_object(
			         'nonce', $2::text,
			         'nextAttempt', $4::integer,
			         'nextProbeAt', $5::text
			       )
			     ),
			 updated_at = updated_at
			 WHERE id = $1::uuid
			   AND status = 'configuring'
			   AND (dns -> 'triggerConfiguration') @> jsonb_build_object(
			     'nonce', $2::text,
			     'nextAttempt', $3::integer
			   )
			 RETURNING id`,
			[
				domainId,
				persisted.nonce,
				input.expectedAttempt,
				persisted.nextAttempt,
				nextProbeAt,
			],
		);

		return result.rows.length === 1;
	}

	async clearCursor(domainId: string, nonce: string): Promise<boolean> {
		parseDomainConfigurationCursor({
			nextAttempt: 0,
			nextProbeAt: null,
			nonce,
		});

		const result = await this.db.$client.query<{ id: string }>(
			`UPDATE domains
			 SET dns = (CASE WHEN jsonb_typeof(dns) = 'object' THEN dns ELSE '{}'::jsonb END)
			     - 'triggerConfiguration',
			 updated_at = updated_at
			 WHERE id = $1::uuid
			   AND (dns -> 'triggerConfiguration') @> jsonb_build_object(
			     'nonce', $2::text
			   )
			 RETURNING id`,
			[domainId, nonce],
		);

		// Activation and terminalization change the domain status before cleanup,
		// so nonce matching, rather than a configuring-only predicate, owns clear.
		return result.rows.length === 1;
	}

	async findByPaymentOrderIdForUpdate(
		paymentOrderId: string,
		tx: DomainTransaction,
	): Promise<DomainRow | null> {
		// This is the same lock used by findOrCreatePurchasedForOrder. A refund
		// therefore either sees and fences the linked row, or commits the refunded
		// order before a stale fulfillment is allowed to create that row.
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext('domain-order:' || ${paymentOrderId}::text))`,
		);
		const [row] = await tx
			.select()
			.from(domains)
			.where(eq(domains.paymentOrderId, paymentOrderId))
			.limit(1)
			.for("update");

		return row ?? null;
	}

	async findOrCreatePurchasedForOrder(
		input: CreatePurchasedOrderDomainInput,
	): Promise<DomainRow> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('domain-order:' || ${input.paymentOrderId}::text))`,
			);
			const [order] = await tx
				.select({ status: paymentOrders.status })
				.from(paymentOrders)
				.where(eq(paymentOrders.id, input.paymentOrderId))
				.limit(1)
				.for("update");

			if (!order || !["paid", "fulfilling"].includes(order.status)) {
				throw new InvalidDomainStateError(
					"Payment order is no longer eligible for domain fulfillment",
				);
			}

			const [existing] = await tx
				.select()
				.from(domains)
				.where(eq(domains.paymentOrderId, input.paymentOrderId))
				.limit(1);

			if (existing) {
				return existing;
			}

			await this.deleteTerminalNameOrThrow(tx, input.name);

			return this.insertPurchased(tx, input);
		});
	}

	async createExternal(input: CreateExternalDomainInput): Promise<DomainRow> {
		return this.insertExternal(this.db, input);
	}

	async createExternalReplacingTerminal(
		input: CreateExternalDomainInput,
	): Promise<DomainRow> {
		return this.db.transaction(async (tx) => {
			await this.deleteTerminalNameOrThrow(tx, input.name);

			return this.insertExternal(tx, input);
		});
	}

	async deleteById(id: string): Promise<void> {
		await this.db.delete(domains).where(eq(domains.id, id));
	}

	async updateById(id: string, patch: DomainUpdate): Promise<DomainRow> {
		const [row] = await this.db
			.update(domains)
			.set(patch)
			.where(eq(domains.id, id))
			.returning();

		return this.expectRow(row);
	}

	async updateIfStatus(
		id: string,
		statuses: DomainStatus[],
		patch: DomainUpdate,
	): Promise<DomainRow> {
		const row = await this.updateIfStatusOrNull(id, statuses, patch);

		if (!row) {
			throw new InvalidDomainStateError();
		}

		return row;
	}

	async updateIfStatusOrNull(
		id: string,
		statuses: DomainStatus[],
		patch: DomainUpdate,
		db: Database | DomainTransaction = this.db,
	): Promise<DomainRow | null> {
		const [row] = await db
			.update(domains)
			.set(patch)
			.where(and(eq(domains.id, id), inArray(domains.status, statuses)))
			.returning();

		return row ?? null;
	}

	async setPrimary(id: string, scope: ProjectScope): Promise<DomainRow> {
		// Access checked scope-aware BEFORE the transaction narrows to the id.
		await this.getByIdForScope(id, scope);

		return this.db.transaction(async (tx) => {
			const [target] = await tx
				.select()
				.from(domains)
				.where(eq(domains.id, id))
				.limit(1);

			const row = this.expectRow(target);

			if (!row.projectId || row.status !== "active") {
				throw new InvalidDomainStateError(
					"Only active domains attached to a project can be primary",
				);
			}

			// One primary per PROJECT: clear every attached domain's flag, not just
			// the same purchaser's — org projects can hold several buyers' domains.
			await tx
				.update(domains)
				.set({ isPrimary: false })
				.where(eq(domains.projectId, row.projectId));

			const [updated] = await tx
				.update(domains)
				.set({ isPrimary: true })
				.where(eq(domains.id, id))
				.returning();

			return this.expectRow(updated);
		});
	}

	async detach(id: string, scope: ProjectScope): Promise<DomainRow> {
		const row = await this.getByIdForScope(id, scope);

		if (row.projectId === null && !row.isPrimary) {
			return row;
		}

		return this.updateById(id, {
			isPrimary: false,
			projectId: null,
		});
	}

	async findActiveByProject(projectId: string): Promise<DomainRow[]> {
		return this.db
			.select()
			.from(domains)
			.where(
				and(eq(domains.projectId, projectId), eq(domains.status, "active")),
			)
			.orderBy(desc(domains.updatedAt));
	}

	// Expiry-notice sweep input: every purchased domain nearing expiry, whether
	// or not auto-renew is set — renewal is not wired yet, only notices are.
	async findExpiringPurchased(
		now = new Date(),
		limit = DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
	): Promise<DomainRow[]> {
		const expiringBy = new Date(now);
		expiringBy.setUTCDate(expiringBy.getUTCDate() + 30);

		return (
			this.db
				.select()
				.from(domains)
				.where(
					and(
						eq(domains.source, "purchased"),
						inArray(domains.status, ["active", "expired"]),
						sql`${domains.expiresAt} IS NOT NULL`,
						sql`${domains.expiresAt} <= ${expiringBy}`,
					),
				)
				// Notice writes advance updatedAt, so oldest-first ordering lets later
				// rows make progress across bounded daily batches.
				.orderBy(asc(domains.updatedAt), domains.expiresAt, domains.id)
				.limit(boundedRepositoryLimit(limit))
		);
	}

	async findPurchasedForSync(
		limit = DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
	): Promise<DomainRow[]> {
		return this.db
			.select()
			.from(domains)
			.where(
				and(
					eq(domains.source, "purchased"),
					eq(domains.provider, "namecom"),
					sql`${domains.providerDomainId} IS NOT NULL`,
					sql`${domains.status} NOT IN ('failed', 'transferred_out')`,
				),
			)
			.orderBy(asc(domains.updatedAt), asc(domains.id))
			.limit(boundedRepositoryLimit(limit));
	}

	recordRenewalNotice(id: string, message: string): Promise<DomainRow> {
		return this.updateById(id, { error: message });
	}

	markFailed(id: string, summary: string): Promise<DomainRow> {
		return this.updateById(id, {
			error: summary,
			isPrimary: false,
			status: "failed",
		});
	}

	setDns(id: string, dns: DomainDns): Promise<DomainRow> {
		return this.updateById(id, { dns });
	}

	private async deleteTerminalNameOrThrow(
		tx: DomainTransaction,
		name: string,
	): Promise<void> {
		const [existing] = await tx
			.select()
			.from(domains)
			.where(eq(domains.name, name))
			.limit(1);

		if (!existing) {
			return;
		}

		if (!isTerminalDomainStatus(existing.status)) {
			throw new DomainAlreadyExistsError(name);
		}

		await tx.delete(domains).where(eq(domains.id, existing.id));
	}

	private async insertPurchased(
		db: Database | DomainTransaction,
		input: PurchasedDomainInsertInput,
	): Promise<DomainRow> {
		const [inserted] = await db
			.insert(domains)
			.values({
				// Off by default: renewal and privacy are separate paid costs the
				// customer has not consented to at registration time.
				autoRenew: false,
				name: input.name,
				paymentOrderId: input.paymentOrderId ?? null,
				priceSnapshot: input.priceSnapshot,
				projectId: input.projectId ?? null,
				provider: "namecom",
				registrant: input.registrant,
				source: "purchased",
				status: "registering",
				tld: input.tld,
				userId: input.userId,
				whoisPrivacy: input.whoisPrivacy ?? false,
			})
			.onConflictDoNothing({ target: domains.name })
			.returning();

		if (!inserted) {
			throw new DomainAlreadyExistsError(input.name);
		}

		return inserted;
	}

	private async insertExternal(
		db: Database | DomainTransaction,
		input: CreateExternalDomainInput,
	): Promise<DomainRow> {
		const [inserted] = await db
			.insert(domains)
			.values({
				autoRenew: false,
				name: input.name,
				projectId: input.projectId,
				provider: null,
				source: "external",
				status: "configuring",
				tld: input.tld,
				userId: input.userId,
				whoisPrivacy: false,
			})
			.onConflictDoNothing({ target: domains.name })
			.returning();

		if (!inserted) {
			throw new DomainAlreadyExistsError(input.name);
		}

		return inserted;
	}

	private expectRow(row: DomainRow | null | undefined): DomainRow {
		if (!row) {
			throw new NotFoundException("Domain not found");
		}

		return row;
	}
}

export function isTerminalDomainStatus(status: DomainStatus) {
	return status === "failed" || status === "transferred_out";
}

function boundedRepositoryLimit(limit: number): number {
	if (!Number.isFinite(limit)) {
		return DOMAIN_REPOSITORY_MAX_BATCH_SIZE;
	}

	return Math.min(
		DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
		Math.max(1, Math.floor(limit)),
	);
}

function cursorFromDns(dns: unknown): DomainConfigurationCursor | null {
	if (typeof dns !== "object" || dns === null || Array.isArray(dns)) {
		return null;
	}

	const triggerConfiguration = (dns as { triggerConfiguration?: unknown })
		.triggerConfiguration;

	if (triggerConfiguration === undefined) {
		return null;
	}

	return parseDomainConfigurationCursor(triggerConfiguration);
}
