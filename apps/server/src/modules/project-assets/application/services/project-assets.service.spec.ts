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
	VARIANT_FILENAME_PATTERN: /\.w\d+\.webp$/,
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
	projects?: Array<{ id: string; name: string }>;
	scopeImageAttempts?: unknown[];
	scopeVideoUrls?: string[];
	scopeVideos?: unknown[];
	videos?: unknown[];
}) {
	const projectAssetsRepository = {
		isProjectAccessible: vi.fn().mockResolvedValue(overrides?.owned ?? true),
		listAccessibleProjects: vi
			.fn()
			.mockResolvedValue(overrides?.projects ?? []),
	};
	const imageGenerationsRepository = {
		listForProject: vi.fn().mockResolvedValue(overrides?.imageAttempts ?? []),
		listSucceededForScope: vi
			.fn()
			.mockResolvedValue(overrides?.scopeImageAttempts ?? []),
	};
	const scopeVideos = (overrides?.scopeVideos ?? []) as Array<{
		videoUrl: string | null;
	}>;
	const mediaGenerationsRepository = {
		listSucceededForProject: vi.fn().mockResolvedValue(overrides?.videos ?? []),
		listSucceededForScope: vi.fn().mockResolvedValue(scopeVideos),
		// Dedupe source: by default every succeeded scope video's URL, exactly
		// what the real uncapped query would return for these fixtures.
		listSucceededVideoUrlsForScope: vi
			.fn()
			.mockResolvedValue(
				overrides?.scopeVideoUrls ??
					scopeVideos.flatMap((row) => (row.videoUrl ? [row.videoUrl] : [])),
			),
	};
	const service = new ProjectAssetsService(
		projectAssetsRepository as unknown as ProjectAssetsRepository,
		imageGenerationsRepository as unknown as ImageGenerationsRepository,
		mediaGenerationsRepository as unknown as MediaGenerationsRepository,
	);

	return {
		imageGenerationsRepository,
		mediaGenerationsRepository,
		projectAssetsRepository,
		service,
	};
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

	it("hides srcset renditions from the tab", async () => {
		vi.mocked(listObjectsByPrefix).mockResolvedValue([
			{
				key: `sites/${PROJECT_ID}/assets/a1/img-1.webp`,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 1_234,
			},
			{
				key: `sites/${PROJECT_ID}/assets/a1/img-1.w480.webp`,
				lastModified: new Date("2026-07-25T08:00:01.000Z"),
				sizeBytes: 120,
			},
			{
				key: `sites/${PROJECT_ID}/assets/a1/img-1.w960.webp`,
				lastModified: new Date("2026-07-25T08:00:02.000Z"),
				sizeBytes: 340,
			},
		]);
		const { service } = setup();

		const assets = await service.listAssets(SCOPE, PROJECT_ID);

		// Renditions are machine copies of a card the user already sees.
		expect(assets.map((asset) => asset.key)).toEqual([
			`sites/${PROJECT_ID}/assets/a1/img-1.webp`,
		]);
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

describe("ProjectAssetsService.listWorkspaceAssets", () => {
	const OTHER_PROJECT_ID = "66666666-6666-4666-8666-666666666666";

	it("merges images, videos and build files across projects, newest first, with projects attached", async () => {
		const videoKey = `sites/${OTHER_PROJECT_ID}/assets/v1/vid-1.mp4`;
		vi.mocked(listObjectsByPrefix).mockImplementation(async (prefix) =>
			prefix.startsWith(`sites/${PROJECT_ID}/`)
				? [
						{
							key: `sites/${PROJECT_ID}/assets/b1/img-9.webp`,
							lastModified: new Date("2026-07-25T13:00:00.000Z"),
							sizeBytes: 111,
						},
					]
				: [],
		);
		const { service } = setup({
			projects: [
				{ id: PROJECT_ID, name: "Sahara Serum" },
				{ id: OTHER_PROJECT_ID, name: "Atlas Honey" },
			],
			scopeImageAttempts: [{ ...IMAGE_ATTEMPT, projectName: "Sahara Serum" }],
			scopeVideos: [
				{
					completedAt: new Date("2026-07-25T10:00:00.000Z"),
					createdAt: new Date("2026-07-25T09:59:00.000Z"),
					id: "44444444-4444-4444-8444-444444444444",
					kind: "image-animation",
					projectId: OTHER_PROJECT_ID,
					projectName: "Atlas Honey",
					prompt: "Slow push.",
					title: null,
					videoMediaType: "video/mp4",
					videoUrl: `https://assets.example.com/${videoKey}`,
				},
			],
		});

		const result = await service.listWorkspaceAssets(SCOPE);

		expect(result.truncated).toBe(false);
		// Build file (13:00) → images (12:00) → video (10:00).
		expect(result.assets.map((asset) => asset.source)).toEqual([
			"page-build",
			"image-generation",
			"image-generation",
			"image-animation",
		]);
		expect(result.assets[0]?.projectName).toBe("Sahara Serum");
		expect(result.assets.at(-1)?.projectId).toBe(OTHER_PROJECT_ID);
		expect(result.assets.at(-1)?.projectName).toBe("Atlas Honey");
		// One prefix listing per accessible project.
		expect(vi.mocked(listObjectsByPrefix).mock.calls.map(([p]) => p)).toEqual([
			`sites/${PROJECT_ID}/assets/`,
			`sites/${OTHER_PROJECT_ID}/assets/`,
		]);
	});

	it("dedupes animation videos out of the cross-project build fan-out", async () => {
		const videoKey = `sites/${PROJECT_ID}/assets/a2/vid-1.mp4`;
		vi.mocked(listObjectsByPrefix).mockResolvedValue([
			{
				key: videoKey,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 5,
			},
		]);
		const { service } = setup({
			projects: [{ id: PROJECT_ID, name: "Sahara Serum" }],
			scopeVideos: [
				{
					completedAt: new Date("2026-07-25T10:00:00.000Z"),
					createdAt: new Date("2026-07-25T09:59:00.000Z"),
					id: "55555555-5555-4555-8555-555555555555",
					kind: "image-animation",
					projectId: PROJECT_ID,
					projectName: "Sahara Serum",
					prompt: "Slow push.",
					title: null,
					videoMediaType: "video/mp4",
					videoUrl: `https://assets.example.com/${videoKey}`,
				},
			],
		});

		const result = await service.listWorkspaceAssets(SCOPE);

		expect(result.assets).toHaveLength(1);
		expect(result.assets[0]?.source).toBe("image-animation");
	});

	it("pins the DB row caps and reports truncation when a cap fills", async () => {
		const cappedAttempts = Array.from({ length: 500 }, (_, index) => ({
			...IMAGE_ATTEMPT,
			id: `88888888-8888-4888-8888-${String(index).padStart(12, "0")}`,
			images: null,
		}));
		const { imageGenerationsRepository, mediaGenerationsRepository, service } =
			setup({
				projects: [{ id: PROJECT_ID, name: "Sahara Serum" }],
				scopeImageAttempts: cappedAttempts,
			});

		const result = await service.listWorkspaceAssets(SCOPE);

		expect(
			imageGenerationsRepository.listSucceededForScope,
		).toHaveBeenCalledWith(SCOPE, 500);
		expect(
			mediaGenerationsRepository.listSucceededForScope,
		).toHaveBeenCalledWith(SCOPE, 500);
		// A full 500-row read means older rows may exist — the flag must say so.
		expect(result.truncated).toBe(true);
	});

	it("reports truncation when a project's R2 prefix listing is cut", async () => {
		vi.mocked(listObjectsByPrefix).mockResolvedValue(
			Array.from({ length: 501 }, (_, index) => ({
				key: `sites/${PROJECT_ID}/assets/b/img-${index}.webp`,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 1,
			})),
		);
		const { service } = setup({
			projects: [{ id: PROJECT_ID, name: "Sahara Serum" }],
		});

		const result = await service.listWorkspaceAssets(SCOPE);

		// The probe asks for cap+1; the response keeps the cap and flags the cut.
		expect(vi.mocked(listObjectsByPrefix)).toHaveBeenCalledWith(
			`sites/${PROJECT_ID}/assets/`,
			501,
		);
		expect(result.assets).toHaveLength(500);
		expect(result.truncated).toBe(true);
	});

	it("dedupes an animation whose row fell outside the display cap", async () => {
		const videoKey = `sites/${PROJECT_ID}/assets/old/vid-1.mp4`;
		vi.mocked(listObjectsByPrefix).mockResolvedValue([
			{
				key: videoKey,
				lastModified: new Date("2026-07-25T08:00:00.000Z"),
				sizeBytes: 5,
			},
		]);
		const { service } = setup({
			projects: [{ id: PROJECT_ID, name: "Sahara Serum" }],
			// Display rows are empty (row aged out of the 500 cap), but the
			// uncapped URL sweep still knows this file is an animation.
			scopeVideoUrls: [`https://assets.example.com/${videoKey}`],
			scopeVideos: [],
		});

		const result = await service.listWorkspaceAssets(SCOPE);

		expect(result.assets).toHaveLength(0);
	});

	it("reports truncation when the project fan-out cap is exceeded", async () => {
		const projects = Array.from({ length: 51 }, (_, index) => ({
			id: `77777777-7777-4777-8777-${String(index).padStart(12, "0")}`,
			name: `Project ${index}`,
		}));
		const { service } = setup({ projects });

		const result = await service.listWorkspaceAssets(SCOPE);

		expect(result.truncated).toBe(true);
		// Only the 50 most recently touched projects are scanned.
		expect(vi.mocked(listObjectsByPrefix)).toHaveBeenCalledTimes(50);
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
