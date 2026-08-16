import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	type AcademyGuide,
	type AcademyGuideListItem,
	type AdminAcademyGuideListItem,
	type AdminListAcademyGuidesQuery,
	type AdminListAcademyGuidesResponse,
	academyGuideStatusSchema,
	type CreateAcademyGuideInput,
	type DeleteAcademyGuideResponse,
	type ListAcademyGuidesResponse,
	parseYouTubeVideoId,
	type UpdateAcademyGuideInput,
} from "@wandit/contracts";

import {
	isAcademyGuideHtmlEmpty,
	sanitizeAcademyGuideHtml,
} from "../../domain/academy-guide-html";
import type {
	AcademyGuideInsert,
	AcademyGuideListRow,
	AcademyGuideRow,
	AdminAcademyGuideListRow,
} from "../../infrastructure/persistence/academy.repository";
import { AcademyRepository } from "../../infrastructure/persistence/academy.repository";

const invalidYoutubeUrlMessage =
	"youtubeUrl must be a supported YouTube video URL";
const missingContentMessage =
	"An academy guide must include a YouTube video or non-empty body";

@Injectable()
export class AcademyService {
	constructor(
		@Inject(AcademyRepository)
		private readonly repository: AcademyRepository,
	) {}

	async listPublished(): Promise<ListAcademyGuidesResponse> {
		const rows = await this.repository.listPublished();

		return rows.map(mapAcademyGuideListItem);
	}

	async getPublishedById(guideId: string): Promise<AcademyGuide> {
		const row = await this.repository.findPublishedById(guideId);

		if (row?.status !== "published") {
			throw new NotFoundException("Academy guide not found");
		}

		return mapAcademyGuide(row);
	}

	async adminList(
		query: AdminListAcademyGuidesQuery,
	): Promise<AdminListAcademyGuidesResponse> {
		const page = await this.repository.adminList(query);

		return {
			items: page.items.map(mapAdminAcademyGuideListItem),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async adminGetById(guideId: string): Promise<AcademyGuide> {
		const row = await this.repository.findById(guideId);

		if (!row) {
			throw new NotFoundException("Academy guide not found");
		}

		return mapAcademyGuide(row);
	}

	async create(
		input: CreateAcademyGuideInput,
		createdByUserId: string,
	): Promise<AcademyGuide> {
		const youtubeUrl = input.youtubeUrl ?? null;
		const youtubeVideoId = deriveYouTubeVideoId(youtubeUrl);
		const bodyHtml = normalizeAcademyGuideBodyHtml(input.bodyHtml ?? "");

		assertGuideHasContent(youtubeVideoId, bodyHtml);

		const status = input.status ?? "draft";
		const row = await this.repository.insert({
			title: input.title,
			description: input.description ?? null,
			category: input.category ?? null,
			youtubeUrl,
			youtubeVideoId,
			bodyHtml,
			status,
			publishedAt: status === "published" ? new Date() : null,
			createdByUserId,
		});

		return mapAcademyGuide(row);
	}

	async update(
		guideId: string,
		input: UpdateAcademyGuideInput,
	): Promise<AcademyGuide> {
		const existing = await this.repository.findById(guideId);

		if (!existing) {
			throw new NotFoundException("Academy guide not found");
		}

		const existingStatus = academyGuideStatusSchema.parse(existing.status);
		const bodyHtml =
			input.bodyHtml === undefined
				? existing.bodyHtml
				: normalizeAcademyGuideBodyHtml(input.bodyHtml);
		const youtubeVideoId =
			input.youtubeUrl === undefined
				? existing.youtubeVideoId
				: deriveYouTubeVideoId(input.youtubeUrl);

		assertGuideHasContent(youtubeVideoId, bodyHtml);

		const nextStatus = input.status ?? existingStatus;
		const values: Partial<AcademyGuideInsert> = {};

		if (input.title !== undefined) {
			values.title = input.title;
		}
		if (input.description !== undefined) {
			values.description = input.description;
		}
		if (input.category !== undefined) {
			values.category = input.category;
		}
		if (input.youtubeUrl !== undefined) {
			values.youtubeUrl = input.youtubeUrl;
			values.youtubeVideoId = youtubeVideoId;
		}
		if (input.bodyHtml !== undefined) {
			values.bodyHtml = bodyHtml;
		}
		if (input.status !== undefined) {
			values.status = input.status;
		}
		if (
			existingStatus !== "published" &&
			nextStatus === "published" &&
			existing.publishedAt === null
		) {
			values.publishedAt = new Date();
		}

		const updated = await this.repository.update(guideId, values);

		if (!updated) {
			throw new NotFoundException("Academy guide not found");
		}

		return mapAcademyGuide(updated);
	}

	async delete(guideId: string): Promise<DeleteAcademyGuideResponse> {
		if (!(await this.repository.deleteById(guideId))) {
			throw new NotFoundException("Academy guide not found");
		}

		return { deleted: true };
	}
}

function deriveYouTubeVideoId(youtubeUrl: string | null): string | null {
	if (youtubeUrl === null) {
		return null;
	}

	const videoId = parseYouTubeVideoId(youtubeUrl);

	if (!videoId) {
		throw new BadRequestException(invalidYoutubeUrlMessage);
	}

	return videoId;
}

function normalizeAcademyGuideBodyHtml(bodyHtml: string): string {
	const sanitizedBodyHtml = sanitizeAcademyGuideHtml(bodyHtml);

	return isAcademyGuideHtmlEmpty(sanitizedBodyHtml) ? "" : sanitizedBodyHtml;
}

function assertGuideHasContent(
	youtubeVideoId: string | null,
	bodyHtml: string,
): void {
	if (youtubeVideoId === null && isAcademyGuideHtmlEmpty(bodyHtml)) {
		throw new BadRequestException(missingContentMessage);
	}
}

function mapAcademyGuide(row: AcademyGuideRow): AcademyGuide {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		category: row.category,
		youtubeUrl: row.youtubeUrl,
		youtubeVideoId: row.youtubeVideoId,
		bodyHtml: row.bodyHtml,
		status: academyGuideStatusSchema.parse(row.status),
		publishedAt: row.publishedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function mapAdminAcademyGuideListItem(
	row: AdminAcademyGuideListRow,
): AdminAcademyGuideListItem {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		category: row.category,
		youtubeUrl: row.youtubeUrl,
		youtubeVideoId: row.youtubeVideoId,
		status: academyGuideStatusSchema.parse(row.status),
		publishedAt: row.publishedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function mapAcademyGuideListItem(
	row: AcademyGuideListRow,
): AcademyGuideListItem {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		category: row.category,
		youtubeVideoId: row.youtubeVideoId,
		publishedAt: row.publishedAt?.toISOString() ?? null,
	};
}
