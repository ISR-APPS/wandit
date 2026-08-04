/**
 * Persistence for captured leads.
 *
 * Two access paths with different trust levels: the public capture endpoint
 * resolves a project by its unguessable publicFormId (no user in sight), and
 * the workspace endpoints prove ownership in SQL through the projects join
 * (misses read as 404, never 403 — docs/api-security.md).
 */

import { Inject, Injectable } from "@nestjs/common";
import type { LeadStatus, LeadsQuery, LeadTotals } from "@wandit/contracts";
import { and, desc, eq, gt, isNull, lt, or, sql } from "@wandit/db";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

export type LeadRow = {
	attribution: unknown;
	commune: string | null;
	createdAt: Date;
	extras: unknown;
	id: string;
	name: string;
	phone: string;
	status: LeadStatus;
	wilaya: string | null;
};

const LEAD_COLUMNS = {
	attribution: leads.attribution,
	commune: leads.commune,
	createdAt: leads.createdAt,
	extras: leads.extras,
	id: leads.id,
	name: leads.name,
	phone: leads.phone,
	status: leads.status,
	wilaya: leads.wilaya,
} as const;

const LEAD_PAGE_COLUMNS = {
	...LEAD_COLUMNS,
	// node-postgres turns timestamptz into a millisecond-resolution Date. Keep
	// the database's full microsecond value solely for the keyset cursor so a
	// boundary cannot skip rows captured within the same millisecond.
	cursorCreatedAt:
		sql<string>`to_char(${leads.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
			"lead_cursor_created_at",
		),
} as const;

const LEGACY_RECENT_LIMIT = 1_000;
const OWNER_PAGE_SIZE_MAX = 100;
const SYNC_PAGE_SIZE_MAX = 1_000;
const CURSOR_CREATED_AT_RE =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/;
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LeadListFilters = Pick<LeadsQuery, "q" | "status">;

type LeadCursor = {
	createdAt: string;
	id: string;
};

export type LeadPageResult = {
	nextCursor: string | null;
	rows: LeadRow[];
};

export type LeadSyncPageOptions = {
	cursor?: string;
	pageSize: number;
};

export class InvalidLeadCursorError extends Error {
	constructor() {
		super("Invalid lead cursor");
		this.name = "InvalidLeadCursorError";
	}
}

function encodeLeadCursor(cursor: LeadCursor): string {
	return Buffer.from(JSON.stringify({ ...cursor, v: 1 }), "utf8").toString(
		"base64url",
	);
}

function isValidCursorCreatedAt(value: string): boolean {
	const match = CURSOR_CREATED_AT_RE.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [
		31,
		leapYear ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	][month - 1];

	return (
		year >= 1 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		daysInMonth !== undefined &&
		day <= daysInMonth &&
		hour <= 23 &&
		minute <= 59 &&
		second <= 59
	);
}

function decodeLeadCursor(cursor: string): LeadCursor {
	try {
		if (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 1_000) {
			throw new InvalidLeadCursorError();
		}

		const decoded: unknown = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		);
		if (
			!decoded ||
			typeof decoded !== "object" ||
			!("v" in decoded) ||
			decoded.v !== 1 ||
			!("createdAt" in decoded) ||
			typeof decoded.createdAt !== "string" ||
			!isValidCursorCreatedAt(decoded.createdAt) ||
			!("id" in decoded) ||
			typeof decoded.id !== "string" ||
			!UUID_RE.test(decoded.id)
		) {
			throw new InvalidLeadCursorError();
		}

		return { createdAt: decoded.createdAt, id: decoded.id };
	} catch (error) {
		if (error instanceof InvalidLeadCursorError) {
			throw error;
		}

		throw new InvalidLeadCursorError();
	}
}

function clampPageSize(pageSize: number, maximum: number): number {
	return Math.min(maximum, Math.max(1, Math.floor(pageSize)));
}

function normalizedPhoneDigits(value: string): string {
	const asciiDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => {
		const codePoint = digit.charCodeAt(0);
		return String(
			codePoint >= 0x06f0 ? codePoint - 0x06f0 : codePoint - 0x0660,
		);
	});
	const digits = asciiDigits.replace(/\D/g, "");

	if (digits.startsWith("00")) {
		return digits.slice(2);
	}

	return digits.replace(/^0/, "");
}

function escapedContainsPattern(value: string): string {
	return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

@Injectable()
export class LeadsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Capture path: unguessable form id → live project, or null. */
	async findProjectByPublicFormId(
		publicFormId: string,
	): Promise<{ id: string } | null> {
		const [row] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.publicFormId, publicFormId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/** Which live deployment captured the lead — null before publishing exists. */
	async findActiveDeploymentId(projectId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ id: deployments.id })
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "active"),
				),
			)
			.limit(1);

		return row?.id ?? null;
	}

	/** Double-submit guard: same phone on the same project since `since`. */
	async hasRecentLeadWithPhone(
		projectId: string,
		phone: string,
		since: Date,
	): Promise<boolean> {
		const [row] = await this.db
			.select({ id: leads.id })
			.from(leads)
			.where(
				and(
					eq(leads.projectId, projectId),
					eq(leads.phone, phone),
					gt(leads.createdAt, since),
				),
			)
			.limit(1);

		return Boolean(row);
	}

	async insertLead(input: {
		attribution: Record<string, unknown> | null;
		commune: string | null;
		deploymentId: string | null;
		extras: Record<string, unknown> | null;
		name: string;
		phone: string;
		projectId: string;
		wilaya: string | null;
	}): Promise<void> {
		await this.db.insert(leads).values(input);
	}

	async listForProject(
		scope: ProjectScope,
		projectId: string,
		limit = LEGACY_RECENT_LIMIT,
	): Promise<LeadRow[]> {
		return this.listAccessibleRecent(
			scope,
			projectId,
			clampPageSize(limit, LEGACY_RECENT_LIMIT),
		);
	}

	listForProjectPage(
		scope: ProjectScope,
		projectId: string,
		query: LeadsQuery,
	): Promise<LeadPageResult> {
		return this.listAccessiblePage(
			scope,
			projectId,
			query,
			OWNER_PAGE_SIZE_MAX,
		);
	}

	async countForProject(
		scope: ProjectScope,
		projectId: string,
		filters: LeadListFilters = {},
	): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId, filters));

		return row?.total ?? 0;
	}

	async getTotalsForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<LeadTotals> {
		const [row] = await this.db
			.select({
				cancelled: sql<number>`count(*) filter (where ${leads.status} = 'cancelled')::int`,
				confirmed: sql<number>`count(*) filter (where ${leads.status} = 'confirmed')::int`,
				last7Days: sql<number>`count(*) filter (where ${leads.createdAt} >= now() - interval '7 days')::int`,
				today: sql<number>`count(*) filter (where ${leads.createdAt} >= (date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'))::int`,
				total: sql<number>`count(*)::int`,
			})
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId));

		return (
			row ?? {
				cancelled: 0,
				confirmed: 0,
				last7Days: 0,
				today: 0,
				total: 0,
			}
		);
	}

	listForProjectSync(
		scope: ProjectScope,
		projectId: string,
		options: LeadSyncPageOptions,
	): Promise<LeadPageResult> {
		return this.listAccessiblePage(
			scope,
			projectId,
			options,
			SYNC_PAGE_SIZE_MAX,
		);
	}

	private async listAccessiblePage(
		scope: ProjectScope,
		projectId: string,
		options: LeadListFilters & LeadSyncPageOptions,
		maximumPageSize: number,
	): Promise<LeadPageResult> {
		const pageSize = clampPageSize(options.pageSize, maximumPageSize);
		const cursor = options.cursor
			? decodeLeadCursor(options.cursor)
			: undefined;
		const selected = await this.db
			.select(LEAD_PAGE_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId, options, cursor))
			.orderBy(desc(leads.createdAt), desc(leads.id))
			.limit(pageSize + 1);
		const hasNextPage = selected.length > pageSize;
		const page = selected.slice(0, pageSize);
		const last = page.at(-1);

		return {
			nextCursor:
				hasNextPage && last
					? encodeLeadCursor({
							createdAt: last.cursorCreatedAt,
							id: last.id,
						})
					: null,
			rows: page.map(({ cursorCreatedAt: _cursorCreatedAt, ...row }) => row),
		};
	}

	private listAccessibleRecent(
		scope: ProjectScope,
		projectId: string,
		limit: number,
	): Promise<LeadRow[]> {
		return this.db
			.select(LEAD_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(this.accessibleWhere(scope, projectId))
			.orderBy(desc(leads.createdAt), desc(leads.id))
			.limit(limit);
	}

	private accessibleWhere(
		scope: ProjectScope,
		projectId: string,
		filters: LeadListFilters = {},
		cursor?: LeadCursor,
	) {
		const query = filters.q?.trim();
		const phoneDigits = query ? normalizedPhoneDigits(query) : "";
		const search = query
			? or(
					sql<boolean>`${leads.name} ilike ${escapedContainsPattern(query)} escape '\\'`,
					phoneDigits
						? sql<boolean>`regexp_replace(${leads.phone}, '[^0-9]', '', 'g') like ${`%${phoneDigits}%`}`
						: undefined,
				)
			: undefined;
		const afterCursor = cursor
			? or(
					sql<boolean>`${leads.createdAt} < ${cursor.createdAt}::timestamptz`,
					and(
						sql<boolean>`${leads.createdAt} = ${cursor.createdAt}::timestamptz`,
						lt(leads.id, cursor.id),
					),
				)
			: undefined;

		return and(
			eq(leads.projectId, projectId),
			projectScopePredicate(scope),
			isNull(projects.deletedAt),
			filters.status ? eq(leads.status, filters.status) : undefined,
			search,
			afterCursor,
		);
	}

	async updateAccessibleLeadStatus(
		scope: ProjectScope,
		projectId: string,
		leadId: string,
		status: LeadStatus,
	): Promise<LeadRow | null> {
		const [owned] = await this.db
			.select({ id: leads.id })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.id, leadId),
					eq(leads.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!owned) {
			return null;
		}

		const [row] = await this.db
			.update(leads)
			.set({ status, statusChangedAt: new Date() })
			.where(eq(leads.id, leadId))
			.returning(LEAD_COLUMNS);

		return row ?? null;
	}
}
