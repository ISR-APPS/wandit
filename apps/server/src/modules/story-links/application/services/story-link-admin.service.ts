import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	CreateStoryLinkInput,
	ListStoryLinksQuery,
	StoryLink,
	StoryLinkListItem,
	StoryLinkRecentSignup,
	StoryLinkSignupsQuery,
	StoryLinkSignupsResponse,
	StoryLinkStatsQuery,
	StoryLinkStatsResponse,
	StoryLinksResponse,
	UpdateStoryLinkInput,
} from "@wandit/contracts";
import { resolveAdminDashboardRange } from "../../../admin/application/services/admin-dashboard-range";
import type {
	StoryLinkAdminListRecord,
	StoryLinkAdminRow,
	StoryLinkAdminSignupsPage,
	StoryLinkAdminUpdate,
} from "../../infrastructure/persistence/story-link-admin.repository";
import { StoryLinkAdminRepository } from "../../infrastructure/persistence/story-link-admin.repository";

@Injectable()
export class StoryLinkAdminService {
	constructor(
		@Inject(StoryLinkAdminRepository)
		private readonly repository: StoryLinkAdminRepository,
	) {}

	async list(query: ListStoryLinksQuery): Promise<StoryLinksResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.repository.list(resolvedRange.bounds);

		return {
			clicksByDay: snapshot.clicksByDay,
			links: snapshot.links.map(mapStoryLinkListItem),
			updatedAt: generatedAt.toISOString(),
		};
	}

	async stats(
		id: string,
		query: StoryLinkStatsQuery,
	): Promise<StoryLinkStatsResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const snapshot = await this.repository.getStats(id, resolvedRange.bounds);

		if (!snapshot.link) {
			throw new NotFoundException("Story link not found");
		}

		return {
			clicks: snapshot.clicks,
			clicksByDay: snapshot.clicksByDay,
			conversion: snapshot.conversion,
			link: mapStoryLink(snapshot.link),
			signups: snapshot.signups,
			updatedAt: generatedAt.toISOString(),
		};
	}

	async signups(
		id: string,
		query: StoryLinkSignupsQuery,
	): Promise<StoryLinkSignupsResponse> {
		const generatedAt = new Date();
		const resolvedRange = resolveAdminDashboardRange(query, generatedAt);
		const page = await this.repository.listSignups(id, resolvedRange.bounds, {
			page: query.page,
			pageSize: query.pageSize,
		});

		return {
			items: page.items.map(mapSignup),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	async create(input: CreateStoryLinkInput): Promise<StoryLink> {
		try {
			return mapStoryLink(await this.repository.create(input));
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException("Story link slug is already in use");
			}

			throw error;
		}
	}

	async update(id: string, input: UpdateStoryLinkInput): Promise<StoryLink> {
		const changes: StoryLinkAdminUpdate = {};

		if (input.name !== undefined) {
			changes.name = input.name;
		}
		if (input.archived !== undefined) {
			changes.archivedAt = input.archived ? new Date() : null;
		}

		const updated = await this.repository.update(id, changes);

		if (!updated) {
			throw new NotFoundException("Story link not found");
		}

		return mapStoryLink(updated);
	}
}

function mapStoryLink(row: StoryLinkAdminRow): StoryLink {
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		destinationPath: row.destinationPath,
		id: row.id,
		name: row.name,
		slug: row.slug,
		updatedAt: row.updatedAt.toISOString(),
		utmCampaign: row.utmCampaign,
		utmContent: row.utmContent,
		utmMedium: row.utmMedium,
		utmSource: row.utmSource,
	};
}

function mapStoryLinkListItem(
	record: StoryLinkAdminListRecord,
): StoryLinkListItem {
	return {
		allTimeClicks: record.allTimeClicks,
		archivedAt: record.link.archivedAt?.toISOString() ?? null,
		clicksInRange: record.clicksInRange,
		createdAt: record.link.createdAt.toISOString(),
		destinationPath: record.link.destinationPath,
		id: record.link.id,
		name: record.link.name,
		slug: record.link.slug,
		uniqueVisitorsInRange: record.uniqueVisitorsInRange,
		utmCampaign: record.link.utmCampaign,
		utmContent: record.link.utmContent,
		utmMedium: record.link.utmMedium,
		utmSource: record.link.utmSource,
	};
}

function mapSignup(
	signup: StoryLinkAdminSignupsPage["items"][number],
): StoryLinkRecentSignup {
	return {
		convertedToPaid: signup.convertedToPaid,
		email: signup.email,
		image: signup.image,
		name: signup.name,
		signedUpAt: signup.signedUpAt.toISOString(),
		userId: signup.userId,
	};
}

function isUniqueViolation(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: unknown }).code === "23505"
	);
}
