import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { CreateAcademyGuideInput } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
	AcademyGuideInsert,
	AcademyGuideRow,
	AcademyRepository,
	AdminAcademyGuideListRow,
} from "../../infrastructure/persistence/academy.repository";
import { AcademyService } from "./academy.service";

const GUIDE_ID = "11111111-1111-4111-8111-111111111111";
const VIDEO_ID = "dQw4w9WgXcQ";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const CREATED_AT = new Date("2026-08-01T08:00:00.000Z");
const UPDATED_AT = new Date("2026-08-02T09:00:00.000Z");
const FIRST_PUBLISHED_AT = new Date("2026-08-15T10:00:00.000Z");

function guideRow(overrides: Partial<AcademyGuideRow> = {}): AcademyGuideRow {
	return {
		id: GUIDE_ID,
		title: "Build a launch page",
		description: "A practical walkthrough",
		category: "Design",
		youtubeUrl: null,
		youtubeVideoId: null,
		bodyHtml: "<p>Start with a clear brief.</p>",
		status: "draft",
		publishedAt: null,
		createdByUserId: "admin_1",
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function adminListRow(
	overrides: Partial<AdminAcademyGuideListRow> = {},
): AdminAcademyGuideListRow {
	return {
		id: GUIDE_ID,
		title: "Build a launch page",
		description: "A practical walkthrough",
		category: "Design",
		youtubeUrl: YOUTUBE_URL,
		youtubeVideoId: VIDEO_ID,
		status: "published",
		publishedAt: FIRST_PUBLISHED_AT,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		...overrides,
	};
}

function setup(initialRow: AcademyGuideRow | null = guideRow()) {
	let stored = initialRow;
	const repository = {
		listPublished: vi.fn(async () => []),
		findPublishedById: vi.fn(async (id: string) =>
			stored?.id === id && stored.status === "published" ? stored : null,
		),
		adminList: vi.fn(),
		findById: vi.fn(async (id: string) => (stored?.id === id ? stored : null)),
		insert: vi.fn(async (values: AcademyGuideInsert) => {
			stored = guideRow({
				title: values.title,
				description: values.description ?? null,
				category: values.category ?? null,
				youtubeUrl: values.youtubeUrl ?? null,
				youtubeVideoId: values.youtubeVideoId ?? null,
				bodyHtml: values.bodyHtml ?? "",
				status: values.status ?? "draft",
				publishedAt: values.publishedAt ?? null,
				createdByUserId: values.createdByUserId,
			});

			return stored;
		}),
		update: vi.fn(async (id: string, values: Partial<AcademyGuideInsert>) => {
			if (!stored || stored.id !== id) {
				return null;
			}

			stored = { ...stored, ...values } as AcademyGuideRow;

			return stored;
		}),
		deleteById: vi.fn(),
	};
	const service = new AcademyService(
		repository as unknown as AcademyRepository,
	);

	return {
		getStored: () => stored,
		repository,
		service,
	};
}

describe("AcademyService", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("maps the projected admin list without body HTML", async () => {
		const { repository, service } = setup();
		repository.adminList.mockResolvedValue({
			items: [adminListRow()],
			page: 1,
			pageSize: 20,
			total: 1,
		});

		const result = await service.adminList({ page: 1, pageSize: 20 });

		expect(result.items).toEqual([
			{
				id: GUIDE_ID,
				title: "Build a launch page",
				description: "A practical walkthrough",
				category: "Design",
				youtubeUrl: YOUTUBE_URL,
				youtubeVideoId: VIDEO_ID,
				status: "published",
				publishedAt: FIRST_PUBLISHED_AT.toISOString(),
				createdAt: CREATED_AT.toISOString(),
				updatedAt: UPDATED_AT.toISOString(),
			},
		]);
		expect(result.items[0]).not.toHaveProperty("bodyHtml");
	});

	it("sets publishedAt on the first publish and never replaces it", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(FIRST_PUBLISHED_AT);
		const { getStored, repository, service } = setup();

		const firstPublish = await service.update(GUIDE_ID, {
			status: "published",
		});

		expect(firstPublish.publishedAt).toBe(FIRST_PUBLISHED_AT.toISOString());
		expect(repository.update).toHaveBeenNthCalledWith(
			1,
			GUIDE_ID,
			expect.objectContaining({
				publishedAt: FIRST_PUBLISHED_AT,
				status: "published",
			}),
		);

		vi.setSystemTime(new Date("2026-08-16T10:00:00.000Z"));
		await service.update(GUIDE_ID, { status: "draft" });
		vi.setSystemTime(new Date("2026-08-17T10:00:00.000Z"));
		const republished = await service.update(GUIDE_ID, {
			status: "published",
		});

		expect(republished.publishedAt).toBe(FIRST_PUBLISHED_AT.toISOString());
		expect(getStored()?.publishedAt).toEqual(FIRST_PUBLISHED_AT);
	});

	it("keeps publishedAt when unpublishing", async () => {
		const { service } = setup(
			guideRow({
				status: "published",
				publishedAt: FIRST_PUBLISHED_AT,
			}),
		);

		await expect(
			service.update(GUIDE_ID, { status: "draft" }),
		).resolves.toMatchObject({
			status: "draft",
			publishedAt: FIRST_PUBLISHED_AT.toISOString(),
		});
	});

	it("sets publishedAt when a guide is created as published", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(FIRST_PUBLISHED_AT);
		const { repository, service } = setup(null);

		const created = await service.create(
			{
				title: "Published immediately",
				bodyHtml: "<p>Ready to read.</p>",
				status: "published",
			},
			"admin_7",
		);

		expect(created.publishedAt).toBe(FIRST_PUBLISHED_AT.toISOString());
		expect(repository.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				createdByUserId: "admin_7",
				publishedAt: FIRST_PUBLISHED_AT,
				status: "published",
			}),
		);
	});

	it("derives the YouTube video id on create", async () => {
		const { repository, service } = setup(null);
		const input: CreateAcademyGuideInput = {
			title: "Video lesson",
			youtubeUrl: YOUTUBE_URL,
			bodyHtml: "",
		};

		const created = await service.create(input, "admin_2");

		expect(created.youtubeVideoId).toBe(VIDEO_ID);
		expect(repository.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				createdByUserId: "admin_2",
				youtubeUrl: YOUTUBE_URL,
				youtubeVideoId: VIDEO_ID,
			}),
		);
	});

	it("stores an empty body string when a video guide is created with empty markup", async () => {
		const { repository, service } = setup(null);

		const created = await service.create(
			{
				title: "Video lesson",
				youtubeUrl: YOUTUBE_URL,
				bodyHtml: "<p></p>",
			},
			"admin_2",
		);

		expect(created.bodyHtml).toBe("");
		expect(repository.insert).toHaveBeenCalledWith(
			expect.objectContaining({ bodyHtml: "" }),
		);
	});

	it("rejects create after sanitization when it has neither video nor body", async () => {
		const { repository, service } = setup(null);

		await expect(
			service.create(
				{
					title: "Empty guide",
					bodyHtml: "<script>alert('not content')</script><p><br></p>",
				},
				"admin_1",
			),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it("authoritatively rejects an unparseable YouTube URL", async () => {
		const { repository, service } = setup(null);

		await expect(
			service.create(
				{
					title: "Forged video",
					youtubeUrl: `https://example.com/watch?v=${VIDEO_ID}`,
					bodyHtml: "<p>Fallback text</p>",
				},
				"admin_1",
			),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it("sanitizes body HTML before an update is persisted", async () => {
		const { repository, service } = setup();
		const dirtyHtml = [
			'<p class="hero" style="color:red" onclick="steal()">Safe text</p>',
			"<script>alert('xss')</script>",
		].join("");

		const updated = await service.update(GUIDE_ID, { bodyHtml: dirtyHtml });
		const persistedHtml = repository.update.mock.calls[0]?.[1].bodyHtml;

		expect(persistedHtml).toBe("<p>Safe text</p>");
		expect(updated.bodyHtml).toBe("<p>Safe text</p>");
	});

	it("stores an empty body string when a video guide is updated with empty markup", async () => {
		const { repository, service } = setup(
			guideRow({
				youtubeUrl: YOUTUBE_URL,
				youtubeVideoId: VIDEO_ID,
			}),
		);

		const updated = await service.update(GUIDE_ID, { bodyHtml: "<p></p>" });

		expect(updated.bodyHtml).toBe("");
		expect(repository.update).toHaveBeenCalledWith(GUIDE_ID, {
			bodyHtml: "",
		});
	});

	it("merges a title-only PATCH with the persisted body", async () => {
		const { repository, service } = setup(
			guideRow({
				bodyHtml: "<p>Persisted content</p>",
				youtubeUrl: null,
				youtubeVideoId: null,
			}),
		);

		await expect(
			service.update(GUIDE_ID, { title: "Renamed guide" }),
		).resolves.toMatchObject({
			title: "Renamed guide",
			bodyHtml: "<p>Persisted content</p>",
		});
		expect(repository.update).toHaveBeenCalledWith(GUIDE_ID, {
			title: "Renamed guide",
		});
	});

	it("allows clearing a video when the persisted body still has content", async () => {
		const { repository, service } = setup(
			guideRow({
				bodyHtml: "<p>Text alternative</p>",
				youtubeUrl: YOUTUBE_URL,
				youtubeVideoId: VIDEO_ID,
			}),
		);

		await expect(
			service.update(GUIDE_ID, { youtubeUrl: null }),
		).resolves.toMatchObject({
			youtubeUrl: null,
			youtubeVideoId: null,
		});
		expect(repository.update).toHaveBeenCalledWith(
			GUIDE_ID,
			expect.objectContaining({
				youtubeUrl: null,
				youtubeVideoId: null,
			}),
		);
	});

	it("rejects a PATCH that clears the last persisted content", async () => {
		const { repository, service } = setup(
			guideRow({
				bodyHtml: "<p><br></p>",
				youtubeUrl: YOUTUBE_URL,
				youtubeVideoId: VIDEO_ID,
			}),
		);

		await expect(
			service.update(GUIDE_ID, { youtubeUrl: null }),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it("returns 404 when a draft leaks through the published lookup", async () => {
		const { repository, service } = setup();
		repository.findPublishedById.mockResolvedValue(
			guideRow({ status: "draft" }),
		);

		await expect(service.getPublishedById(GUIDE_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
