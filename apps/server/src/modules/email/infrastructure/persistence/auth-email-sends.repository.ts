import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lt, sql } from "@wandit/db";
import { authEmailSends } from "@wandit/db/schema/auth";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type AuthEmailSendKind = "magic-link" | "otp" | "invitation";

export type AuthEmailSendCursor = { id: string; createdAt: Date };

@Injectable()
export class AuthEmailSendsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Returns a cursor identifying the row just written. Callers order
	 * themselves against concurrent peers with it — see countEarlierForEmail.
	 */
	async record(input: {
		actorId: string | null;
		emailCanonical: string;
		ipHash: string | null;
		kind: AuthEmailSendKind;
	}): Promise<AuthEmailSendCursor> {
		const [row] = await this.db
			.insert(authEmailSends)
			.values(input)
			.returning({
				createdAt: authEmailSends.createdAt,
				id: authEmailSends.id,
			});

		if (!row) {
			throw new Error("auth_email_sends insert returned no row");
		}

		return row;
	}

	/**
	 * Sends for this recipient that strictly PRECEDE `cursor` in
	 * (createdAt, id) order. Ordering against a cursor instead of counting
	 * everything is what lets a simultaneous burst resolve to exactly one
	 * winner: each request counts only the attempts ahead of it, so the
	 * earliest sees zero and proceeds while the rest see a full budget.
	 */
	async countEarlierForEmail(
		emailCanonical: string,
		since: Date,
		kinds: AuthEmailSendKind[],
		cursor: AuthEmailSendCursor,
	): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.emailCanonical, emailCanonical),
					gte(authEmailSends.createdAt, since),
					inArray(authEmailSends.kind, kinds),
					sql`(${authEmailSends.createdAt}, ${authEmailSends.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
				),
			);

		return row?.count ?? 0;
	}

	async countEarlierForIp(
		ipHash: string,
		since: Date,
		cursor: AuthEmailSendCursor,
	): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.ipHash, ipHash),
					gte(authEmailSends.createdAt, since),
					sql`(${authEmailSends.createdAt}, ${authEmailSends.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
				),
			);

		return row?.count ?? 0;
	}

	async countForActorSince(
		actorId: string,
		since: Date,
		kinds: AuthEmailSendKind[],
	): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.actorId, actorId),
					gte(authEmailSends.createdAt, since),
					inArray(authEmailSends.kind, kinds),
				),
			);

		return row?.count ?? 0;
	}

	async countForEmailSince(
		emailCanonical: string,
		since: Date,
		kinds: AuthEmailSendKind[],
	): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.emailCanonical, emailCanonical),
					gte(authEmailSends.createdAt, since),
					inArray(authEmailSends.kind, kinds),
				),
			);

		return row?.count ?? 0;
	}

	async lastSendAtForEmail(
		emailCanonical: string,
		kinds: AuthEmailSendKind[],
	): Promise<Date | null> {
		const [row] = await this.db
			.select({ createdAt: authEmailSends.createdAt })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.emailCanonical, emailCanonical),
					inArray(authEmailSends.kind, kinds),
				),
			)
			.orderBy(desc(authEmailSends.createdAt))
			.limit(1);

		return row?.createdAt ?? null;
	}

	async countForIpSince(ipHash: string, since: Date): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(authEmailSends)
			.where(
				and(
					eq(authEmailSends.ipHash, ipHash),
					gte(authEmailSends.createdAt, since),
				),
			);

		return row?.count ?? 0;
	}

	/**
	 * Opportunistic hygiene: rows older than the longest cap window carry no
	 * signal. Called best-effort from the record path — never awaited on the
	 * user's latency-critical path and never allowed to fail a send.
	 */
	async deleteOlderThan(cutoff: Date): Promise<void> {
		await this.db
			.delete(authEmailSends)
			.where(lt(authEmailSends.createdAt, cutoff));
	}
}
