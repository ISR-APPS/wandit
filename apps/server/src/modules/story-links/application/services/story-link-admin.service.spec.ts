import { ConflictException, NotFoundException } from "@nestjs/common";
import { storyLinkSchema, storyLinksResponseSchema } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	StoryLinkAdminRepository,
	StoryLinkAdminRow,
} from "../../infrastructure/persistence/story-link-admin.repository";
import { StoryLinkAdminService } from "./story-link-admin.service";

const STORY_LINK_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-15T10:20:30.000Z");
const ARCHIVED_AT = new Date("2026-08-10T08:00:00.000Z");

function storyLinkRow(
	overrides: Partial<StoryLinkAdminRow> = {},
): StoryLinkAdminRow {
	return {
		archivedAt: null,
		createdAt: new Date("2026-08-01T12:00:00.000Z"),
		destinationPath: "/pricing?plan=pro",
		id: STORY_LINK_ID,
		name: "August launch",
		slug: "august-launch",
		updatedAt: new Date("2026-08-02T12:00:00.000Z"),
		utmCampaign: "august-launch",
		utmContent: "hero",
		utmMedium: "story",
		utmSource: "instagram",
		...overrides,
	};
}

function setup() {
	const repository = {
		create: vi.fn(),
		list: vi.fn(),
		update: vi.fn(),
	};
	const service = new StoryLinkAdminService(
		repository as unknown as StoryLinkAdminRepository,
	);

	return { repository, service };
}

describe("StoryLinkAdminService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("resolves the dashboard range and maps every link, including archived links", async () => {
		const { repository, service } = setup();
		repository.list.mockResolvedValue({
			clicksByDay: [
				{ clicks: 0, date: "2026-08-09" },
				{ clicks: 4, date: "2026-08-10" },
			],
			links: [
				{
					allTimeClicks: 14,
					clicksInRange: 4,
					link: storyLinkRow({ archivedAt: ARCHIVED_AT }),
					uniqueVisitorsInRange: 3,
				},
			],
		});

		const response = await service.list({ range: "7d" });

		expect(repository.list).toHaveBeenCalledWith({
			rangeEnd: NOW,
			rangeStart: new Date("2026-08-09T00:00:00.000Z"),
			seriesEnd: new Date("2026-08-15T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
		expect(storyLinksResponseSchema.parse(response)).toEqual(response);
		expect(response).toMatchObject({
			clicksByDay: [
				{ clicks: 0, date: "2026-08-09" },
				{ clicks: 4, date: "2026-08-10" },
			],
			links: [
				{
					allTimeClicks: 14,
					archivedAt: ARCHIVED_AT.toISOString(),
					clicksInRange: 4,
					uniqueVisitorsInRange: 3,
				},
			],
			updatedAt: NOW.toISOString(),
		});
	});

	it("returns a contract-valid created story link", async () => {
		const { repository, service } = setup();
		repository.create.mockResolvedValue(storyLinkRow());

		const created = await service.create({
			name: "August launch",
			slug: "august-launch",
			utmCampaign: "august-launch",
			utmContent: "hero",
			utmMedium: "story",
			utmSource: "instagram",
		});

		expect(storyLinkSchema.parse(created)).toEqual(created);
		expect(created.createdAt).toBe("2026-08-01T12:00:00.000Z");
	});

	it("converts a PostgreSQL slug uniqueness violation into a conflict", async () => {
		const { repository, service } = setup();
		repository.create.mockRejectedValue(
			Object.assign(new Error("duplicate key"), { code: "23505" }),
		);

		await expect(
			service.create({
				name: "August launch",
				slug: "august-launch",
				utmCampaign: "august-launch",
				utmMedium: "story",
				utmSource: "instagram",
			}),
		).rejects.toMatchObject({
			message: "Story link slug is already in use",
		});
		await expect(
			service.create({
				name: "August launch",
				slug: "august-launch",
				utmCampaign: "august-launch",
				utmMedium: "story",
				utmSource: "instagram",
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("archives and unarchives a story link through archivedAt only", async () => {
		const { repository, service } = setup();
		repository.update.mockImplementation(
			async (_id: string, changes: Partial<StoryLinkAdminRow>) =>
				storyLinkRow({ ...changes, updatedAt: NOW }),
		);

		const archived = await service.update(STORY_LINK_ID, { archived: true });
		const unarchived = await service.update(STORY_LINK_ID, { archived: false });

		expect(repository.update).toHaveBeenNthCalledWith(1, STORY_LINK_ID, {
			archivedAt: NOW,
		});
		expect(repository.update).toHaveBeenNthCalledWith(2, STORY_LINK_ID, {
			archivedAt: null,
		});
		expect(archived.archivedAt).toBe(NOW.toISOString());
		expect(unarchived.archivedAt).toBeNull();
	});

	it("updates a name without changing archive state", async () => {
		const { repository, service } = setup();
		repository.update.mockResolvedValue(storyLinkRow({ name: "New name" }));

		await service.update(STORY_LINK_ID, { name: "New name" });

		expect(repository.update).toHaveBeenCalledWith(STORY_LINK_ID, {
			name: "New name",
		});
	});

	it("returns not found when the update target does not exist", async () => {
		const { repository, service } = setup();
		repository.update.mockResolvedValue(null);

		await expect(
			service.update(STORY_LINK_ID, { archived: true }),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
