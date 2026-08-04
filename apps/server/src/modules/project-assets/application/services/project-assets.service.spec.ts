import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	isR2Configured,
	listObjectsByPrefix,
} from "../../../../infrastructure/storage/r2";
import type {
	ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { ProjectAssetsRepository } from "../../infrastructure/persistence/project-assets.repository";
import { ProjectAssetsService } from "./project-assets.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	contentTypeFor: (path: string) => {
		const extension = path.split(".").pop() ?? "";
		const types: Record<string, string> = {
			mp4: "video/mp4",
			png: "image/png",
			txt: "text/plain; charset=utf-8",
			webp: "image/webp",
		};

		return types[extension] ?? "application/octet-stream";
	},
	getObjectBytes: vi.fn(),
	isR2Configured: vi.fn(() => true),
	listObjectsByPrefix: vi.fn(async () => []),
	publicAssetKeyFromUrl: (url: string) => {
		const base = "https://assets.example.com/";

		return url.startsWith(base) ? url.slice(base.length) : null;
	},
	publicAssetUrl: (key: string) => `https://assets.example.com/${key}`,
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };

const IMAGE_ATTEMPT: ImageGenerationAttemptRow = {
	aspect: "1:1",
	completedAt: new Date("2026-07-25T12:00:00.000Z"),
	count: 2,
	createdAt: new Date("2026-07-25T11:59:00.000Z"),
	error: null,
	id: "33333333-3333-4333-8333-333333333333",
	images: [
		{
			mediaType: "image/png",
			url: `https://assets.example.com/images/${PROJECT_ID}/33333333-3333-4333-8333-333333333333/img-1.png`,
		},
		{
			mediaType: "image/png",
			url: `https://assets.example.com/images/${PROJECT_ID}/33333333-3333-4333-8333-333333333333/img-2.png`,
		},
	],
	projectId: PROJECT_ID,
	prompt: "studio shot",
	sourceImageUrls: [],
	spec: null,
	status: "succeeded",
	title: "Photo produit",
};

function setup(overrides?: {
	imageAttempts?: ImageGenerationAttemptRow[];
	owned?: boolean;
	videos?: unknown[];
}) {
	const projectAssetsRepository = {
		isProjectAccessible: vi.fn().mockResolvedValue(overrides?.owned ?? true),
	};
	const imageGenerationsRepository = {
		listForProject: vi
			.fn()
			.mockResolvedValue(overrides?.imageAttempts ?? []),
	};
	const mediaGenerationsRepository = {
		listSucceededForProject: vi
			.fn()
			.mockResolvedValue(overrides?.videos ?? []),
	};
	const service = new ProjectAssetsService(
		projectAssetsRepository as unknown as ProjectAssetsRepository,
		imageGenerationsRepository as unknown as ImageGenerationsRepository,
		mediaGenerationsRepository as unknown as MediaGenerationsRepository,
	);

	return { projectAssetsRepository, service };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(listObjectsByPrefix).mockResolvedValue([]);
});

describe("ProjectAssetsService.listAssets", () => {
	it("fans a multi-image attempt out into numbered entries", async () => {
		const { service } = setup({ imageAttempts: [IMAGE_ATTEMPT] });

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		expect(assets).toHaveLength(2);
		expect(assets.map((asset) => asset.name)).toEqual([
			"Photo produit (1/2)",
			"Photo produit (2/2)",
		]);
		expect(assets[0]?.source).toBe("image-generation");
		expect(assets[0]?.key).toBe(
			`images/${PROJECT_ID}/${IMAGE_ATTEMPT.id}/img-1.png`,
		);
	});

	it("labels animations from the prompt on a word boundary", async () => {
		const { service } = setup({
			videos: [
				{
					completedAt: new Date("2026-07-25T10:00:00.000Z"),
					createdAt: new Date("2026-07-25T09:59:00.000Z"),
					id: "44444444-4444-4444-8444-444444444444",
					prompt:
						"A very slow cinematic camera push toward the product on the bench",
					videoMediaType: "video/mp4",
					videoUrl: `https://assets.example.com/sites/${PROJECT_ID}/assets/44444444-4444-4444-8444-444444444444/vid-1.mp4`,
				},
			],
		});

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		expect(assets).toHaveLength(1);
		expect(assets[0]?.kind).toBe("video");
		expect(assets[0]?.source).toBe("image-animation");
		expect(assets[0]?.name.endsWith("…")).toBe(true);
		expect(assets[0]?.name.length).toBeLessThanOrEqual(41);
		// Word boundary: never cut mid-word.
		expect(assets[0]?.name).toBe("A very slow cinematic camera push…");
	});

	it("lists build objects by media kind and skips non-media files", async () => {
		vi.mocked(listObjectsByPrefix).mockResolvedValue([
			{
				key: `sites/${PROJECT_ID}/assets/a1/img-1.webp`,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 1_234,
			},
			{
				key: `sites/${PROJECT_ID}/assets/a1/vid-1.mp4`,
				lastModified: new Date("2026-07-25T08:01:00.000Z"),
				sizeBytes: 9_876,
			},
			{
				key: `sites/${PROJECT_ID}/assets/a1/notes.txt`,
				lastModified: new Date("2026-07-25T08:02:00.000Z"),
				sizeBytes: 10,
			},
		]);
		const { service } = setup();

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		expect(assets).toHaveLength(2);
		expect(assets.map((asset) => asset.kind).sort()).toEqual([
			"image",
			"video",
		]);
		expect(assets.every((asset) => asset.source === "page-build")).toBe(true);
		expect(assets[0]?.sizeBytes).not.toBeNull();
	});

	it("dedupes animation videos out of the build listing", async () => {
		const videoKey = `sites/${PROJECT_ID}/assets/a2/vid-1.mp4`;

		vi.mocked(listObjectsByPrefix).mockResolvedValue([
			{
				key: videoKey,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 5,
			},
		]);
		const { service } = setup({
			videos: [
				{
					completedAt: new Date("2026-07-25T10:00:00.000Z"),
					createdAt: new Date("2026-07-25T09:59:00.000Z"),
					id: "55555555-5555-4555-8555-555555555555",
					prompt: "Slow push.",
					videoMediaType: "video/mp4",
					videoUrl: `https://assets.example.com/${videoKey}`,
				},
			],
		});

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		expect(assets).toHaveLength(1);
		expect(assets[0]?.source).toBe("image-animation");
	});

	it("throws NotFound for an unowned project", async () => {
		const { service } = setup({ owned: false });

		await expect(service.listAssets(SCOPE, PROJECT_ID)).rejects.toThrow(
			NotFoundException,
		);
	});

	it("degrades to DB-backed assets when R2 is unconfigured", async () => {
		vi.mocked(isR2Configured).mockReturnValue(false);
		const { service } = setup({ imageAttempts: [IMAGE_ATTEMPT] });

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		expect(assets).toHaveLength(2);
		expect(vi.mocked(listObjectsByPrefix)).not.toHaveBeenCalled();
	});
});

describe("ProjectAssetsService.download", () => {
	it("rejects keys outside the project's asset prefixes", async () => {
		const { service } = setup();

		await expect(
			service.download(SCOPE, PROJECT_ID, "uploads/other-user/x/y.png"),
		).rejects.toThrow(NotFoundException);
		await expect(
			service.download(
				SCOPE,
				PROJECT_ID,
				"sites/99999999-9999-4999-8999-999999999999/assets/a/img-1.png",
			),
		).rejects.toThrow(NotFoundException);
	});
});
