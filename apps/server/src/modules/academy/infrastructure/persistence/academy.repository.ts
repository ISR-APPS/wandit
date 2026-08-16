import { Inject, Injectable } from "@nestjs/common";
import type { AdminListAcademyGuidesQuery } from "@wandit/contracts";
import { and, desc, eq, ilike, sql } from "@wandit/db";
import { academyGuides } from "@wandit/db/schema/academy";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type AcademyGuideRow = typeof academyGuides.$inferSelect;
export type AcademyGuideInsert = typeof academyGuides.$inferInsert;
export type AcademyGuideListRow = Pick<
	AcademyGuideRow,
	"id" | "title" | "description" | "category" | "youtubeVideoId" | "publishedAt"
>;
export type AdminAcademyGuideListRow = Pick<
	AcademyGuideRow,
	| "id"
	| "title"
	| "description"
	| "category"
	| "youtubeUrl"
	| "youtubeVideoId"
	| "status"
	| "publishedAt"
	| "createdAt"
	| "updatedAt"
>;

export type AcademyGuidePage = {
	items: AdminAcademyGuideListRow[];
	page: number;
	pageSize: number;
	total: number;
};

@Injectable()
export class AcademyRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	listPublished(): Promise<AcademyGuideListRow[]> {
		return this.db
			.select({
				id: academyGuides.id,
				title: academyGuides.title,
				description: academyGuides.description,
				category: academyGuides.category,
				youtubeVideoId: academyGuides.youtubeVideoId,
				publishedAt: academyGuides.publishedAt,
			})
			.from(academyGuides)
			.where(eq(academyGuides.status, "published"))
			.orderBy(
				sql`${academyGuides.publishedAt} desc nulls last`,
				desc(academyGuides.createdAt),
			)
			.limit(200);
	}

	async findPublishedById(id: string): Promise<AcademyGuideRow | null> {
		const [row] = await this.db
			.select()
			.from(academyGuides)
			.where(
				and(eq(academyGuides.id, id), eq(academyGuides.status, "published")),
			)
			.limit(1);

		return row ?? null;
	}

	async adminList(
		query: AdminListAcademyGuidesQuery,
	): Promise<AcademyGuidePage> {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;
		const where = and(
			pattern ? ilike(academyGuides.title, pattern) : undefined,
			query.status ? eq(academyGuides.status, query.status) : undefined,
		);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(academyGuides)
				.where(where)
				.then((result) => result[0]),
			this.db
				.select({
					id: academyGuides.id,
					title: academyGuides.title,
					description: academyGuides.description,
					category: academyGuides.category,
					youtubeUrl: academyGuides.youtubeUrl,
					youtubeVideoId: academyGuides.youtubeVideoId,
					status: academyGuides.status,
					publishedAt: academyGuides.publishedAt,
					createdAt: academyGuides.createdAt,
					updatedAt: academyGuides.updatedAt,
				})
				.from(academyGuides)
				.where(where)
				.orderBy(desc(academyGuides.updatedAt), desc(academyGuides.id))
				.limit(query.pageSize)
				.offset(offset),
		]);

		return {
			items: rows,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async findById(id: string): Promise<AcademyGuideRow | null> {
		const [row] = await this.db
			.select()
			.from(academyGuides)
			.where(eq(academyGuides.id, id))
			.limit(1);

		return row ?? null;
	}

	async insert(values: AcademyGuideInsert): Promise<AcademyGuideRow> {
		const [row] = await this.db
			.insert(academyGuides)
			.values(values)
			.returning();

		if (!row) {
			throw new Error("Academy guide insert did not return a row");
		}

		return row;
	}

	async update(
		id: string,
		values: Partial<AcademyGuideInsert>,
	): Promise<AcademyGuideRow | null> {
		const [row] = await this.db
			.update(academyGuides)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(academyGuides.id, id))
			.returning();

		return row ?? null;
	}

	async deleteById(id: string): Promise<boolean> {
		const rows = await this.db
			.delete(academyGuides)
			.where(eq(academyGuides.id, id))
			.returning({ id: academyGuides.id });

		return rows.length > 0;
	}
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
