import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	DomainDns,
	DomainStatus,
	DomainTld,
	Registrant,
} from "@wandit/contracts";
import { and, desc, eq, inArray, sql } from "@wandit/db";
import { domains } from "@wandit/db/schema/domains";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	DomainAlreadyExistsError,
	InvalidDomainStateError,
} from "../../domain/errors/domain.errors";

export type DomainRow = typeof domains.$inferSelect;

export type DomainTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type CreatePurchasedDomainInput = {
	name: string;
	projectId: string;
	registrant: Registrant;
	tld: DomainTld;
	userId: string;
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

	async assertProjectOwned(userId: string, projectId: string): Promise<void> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
					sql`${projects.deletedAt} IS NULL`,
				),
			)
			.limit(1);

		if (!project) {
			throw new NotFoundException("Project not found");
		}
	}

	async listByProject(projectId: string, userId: string): Promise<DomainRow[]> {
		await this.assertProjectOwned(userId, projectId);

		return this.db
			.select()
			.from(domains)
			.where(and(eq(domains.projectId, projectId), eq(domains.userId, userId)))
			.orderBy(desc(domains.createdAt), desc(domains.id));
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

	async createPurchased(input: CreatePurchasedDomainInput): Promise<DomainRow> {
		return this.insertPurchased(this.db, input);
	}

	async createPurchasedReplacingTerminal(
		input: CreatePurchasedDomainInput,
	): Promise<DomainRow> {
		return this.db.transaction(async (tx) => {
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
		const [row] = await this.db
			.update(domains)
			.set(patch)
			.where(and(eq(domains.id, id), inArray(domains.status, statuses)))
			.returning();

		if (!row) {
			throw new InvalidDomainStateError();
		}

		return row;
	}

	async setPrimary(id: string, userId: string): Promise<DomainRow> {
		return this.db.transaction(async (tx) => {
			const [target] = await tx
				.select()
				.from(domains)
				.where(and(eq(domains.id, id), eq(domains.userId, userId)))
				.limit(1);

			const row = this.expectRow(target);

			if (!row.projectId || row.status !== "active") {
				throw new InvalidDomainStateError(
					"Only active domains attached to a project can be primary",
				);
			}

			await tx
				.update(domains)
				.set({ isPrimary: false })
				.where(
					and(eq(domains.userId, userId), eq(domains.projectId, row.projectId)),
				);

			const [updated] = await tx
				.update(domains)
				.set({ isPrimary: true })
				.where(and(eq(domains.id, id), eq(domains.userId, userId)))
				.returning();

			return this.expectRow(updated);
		});
	}

	async detach(id: string, userId: string): Promise<DomainRow> {
		const row = await this.getByIdForUser(id, userId);

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

	async findPurchasedForSync(): Promise<DomainRow[]> {
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
			.orderBy(desc(domains.updatedAt));
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
		input: CreatePurchasedDomainInput,
	): Promise<DomainRow> {
		/*
		 * This insertion is a fulfillment step, not checkout.
		 *
		 * A domain application service will call it only after PaymentsModule
		 * reports a verified webhook. PaymentsModule must not import this
		 * repository directly. Privacy and auto-renew stay off until their separate
		 * costs/consent are represented by that payment flow.
		 */
		const [inserted] = await db
			.insert(domains)
			.values({
				autoRenew: false,
				name: input.name,
				projectId: input.projectId,
				provider: "namecom",
				registrant: input.registrant,
				source: "purchased",
				status: "registering",
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
