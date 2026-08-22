import {
	ConflictException,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import * as cheerio from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	deleteObject,
	getPageHtml,
	isWanditHostedUrl,
	pageHtmlKey,
	putPageHtml,
} from "../../../../infrastructure/storage/r2";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	type PagesRepository,
	VersionConflictError,
} from "../../infrastructure/persistence/pages.repository";
import { PageEditsService } from "./page-edits.service";
import { PagesService } from "./pages.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	deleteObject: vi.fn(),
	getPageHtml: vi.fn(),
	isWanditHostedUrl: vi.fn(() => true),
	pageHtmlKey: vi.fn(
		(projectId: string, versionId: string) =>
			`sites/${projectId}/${versionId}/index.html`,
	),
	putPageHtml: vi.fn(),
}));

const USER_ID = "user_1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ARTIFACT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ARTIFACT_ID = "77777777-7777-4777-8777-777777777777";
const ACTIVE_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const RESTORED_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const RACED_VERSION_ID = "66666666-6666-4666-8666-666666666666";
const IMAGE_GENERATION_ATTEMPT_ID = "99999999-9999-4999-8999-999999999999";
const ACTIVE_PRODUCT_SKU = "ACTIVE-SKU";
const RESTORED_PRODUCT_SKU = "RESTORED-SKU";
const RESTORED_R2_KEY = `sites/${PROJECT_ID}/${RESTORED_VERSION_ID}/index.html`;

function setup() {
	const pagesRepository = {
		findActivePageByProject: vi.fn(),
		findActivePageByProjectUnchecked: vi.fn(),
		findLatestBuilderVersion: vi.fn(),
		findAccessibleVersionById: vi.fn(),
		insertVersionAndActivate: vi.fn(),
	};
	const service = new PageEditsService(
		pagesRepository as unknown as PagesRepository,
	);

	return { pagesRepository, service };
}

function completeThemeHtml(
	content = '<section data-wid="hero"><p data-wid="e-1">Copy</p></section>',
) {
	return `<!doctype html><html><head>
		<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Original+Serif&amp;display=swap">
		<style>:root {
			--background: oklch(0.96 0.02 210);
			--foreground: #172033;
			--primary: #2457a6;
			--primary-foreground: #ffffff;
			--secondary: #dce6f5;
			--accent: #d97706;
			--muted: #64748b;
			--border: #cbd5e1;
			--radius: 0.625rem;
			--font-heading: "Editorial Serif", Georgia, serif;
			--font-body: "Editorial Sans", Arial, sans-serif;
		}</style>
	</head><body>${content}</body></html>`;
}

function mockActivePage(
	pagesRepository: ReturnType<typeof setup>["pagesRepository"],
) {
	pagesRepository.findActivePageByProject.mockResolvedValue({
		artifactId: ARTIFACT_ID,
		version: {
			id: ACTIVE_VERSION_ID,
			number: 3,
			productSku: ACTIVE_PRODUCT_SKU,
			r2Key: `sites/${PROJECT_ID}/${ACTIVE_VERSION_ID}/index.html`,
		},
	});
}

function mockAiActivePage(
	pagesRepository: ReturnType<typeof setup>["pagesRepository"],
) {
	pagesRepository.findActivePageByProjectUnchecked.mockResolvedValue({
		artifactId: ARTIFACT_ID,
		version: {
			id: ACTIVE_VERSION_ID,
			number: 3,
			productSku: ACTIVE_PRODUCT_SKU,
			r2Key: `sites/${PROJECT_ID}/${ACTIVE_VERSION_ID}/index.html`,
		},
	});
}

function mockRestorableVersion(
	pagesRepository: ReturnType<typeof setup>["pagesRepository"],
) {
	pagesRepository.findActivePageByProject.mockResolvedValue({
		artifactId: ARTIFACT_ID,
		version: {
			id: ACTIVE_VERSION_ID,
			number: 3,
			productSku: ACTIVE_PRODUCT_SKU,
			r2Key: `sites/${PROJECT_ID}/${ACTIVE_VERSION_ID}/index.html`,
		},
	});
	pagesRepository.findAccessibleVersionById.mockResolvedValue({
		artifactId: ARTIFACT_ID,
		id: RESTORED_VERSION_ID,
		projectId: PROJECT_ID,
		productSku: RESTORED_PRODUCT_SKU,
		r2Key: RESTORED_R2_KEY,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(deleteObject).mockResolvedValue(undefined);
	vi.mocked(isWanditHostedUrl).mockReturnValue(true);
});

describe("PageEditsService.restoreVersion", () => {
	it("copies a historical version forward and activates the new version", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			"<!doctype html><html><body><section><p>Old copy</p></section></body></html>",
		);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T10:30:00.000Z"),
			number: 4,
		});

		const response = await service.restoreVersion(
			SCOPE,
			PROJECT_ID,
			RESTORED_VERSION_ID,
			{ expectedActiveVersionId: ACTIVE_VERSION_ID },
		);

		expect(getPageHtml).toHaveBeenCalledWith(RESTORED_R2_KEY);
		expect(pagesRepository.findActivePageByProject).toHaveBeenCalledWith(
			SCOPE,
			PROJECT_ID,
		);
		expect(pagesRepository.findAccessibleVersionById).toHaveBeenCalledWith(
			SCOPE,
			RESTORED_VERSION_ID,
		);
		const insert = pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0];
		expect(insert).toEqual({
			artifactId: ARTIFACT_ID,
			expectedActiveVersionId: ACTIVE_VERSION_ID,
			meta: {
				editedWids: [],
				ops: [],
				parentVersionId: ACTIVE_VERSION_ID,
				restoredFromVersionId: RESTORED_VERSION_ID,
				source: "restore",
			},
			projectId: PROJECT_ID,
			productSku: RESTORED_PRODUCT_SKU,
			r2Key: expect.any(String),
			versionId: expect.any(String),
		});
		expect(insert?.versionId).not.toBe(RESTORED_VERSION_ID);
		expect(insert?.versionId).not.toBe(ACTIVE_VERSION_ID);
		expect(insert?.r2Key).not.toBe(RESTORED_R2_KEY);
		expect(pageHtmlKey).toHaveBeenCalledWith(PROJECT_ID, insert?.versionId);
		expect(putPageHtml).toHaveBeenCalledWith(
			insert?.r2Key,
			expect.stringMatching(/data-wid=.*Old copy/s),
		);
		expect(response).toEqual({
			version: {
				createdAt: "2026-07-31T10:30:00.000Z",
				id: insert?.versionId,
				number: 4,
			},
		});
		expect(deleteObject).not.toHaveBeenCalled();
	});

	it("returns 409 when the request's expected active version is stale", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);

		const error = await service
			.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: RACED_VERSION_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getResponse()).toEqual({
			activeVersionId: ACTIVE_VERSION_ID,
			code: "VERSION_CONFLICT",
		});
		expect(getPageHtml).not.toHaveBeenCalled();
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(deleteObject).not.toHaveBeenCalled();
	});

	it("returns 409 when the active version changes during the insert transaction", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			"<!doctype html><html><body><section>Old copy</section></body></html>",
		);
		pagesRepository.insertVersionAndActivate.mockRejectedValue(
			new VersionConflictError(RACED_VERSION_ID),
		);

		const error = await service
			.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getResponse()).toEqual({
			activeVersionId: RACED_VERSION_ID,
			code: "VERSION_CONFLICT",
		});
		expect(deleteObject).toHaveBeenCalledWith(
			vi.mocked(putPageHtml).mock.calls[0]?.[0],
		);
	});

	it("keeps the 409 response when orphan cleanup fails", async () => {
		const { pagesRepository, service } = setup();
		const cleanupError = new Error("R2 unavailable");
		const loggerWarn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		mockRestorableVersion(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			"<!doctype html><html><body><section>Old copy</section></body></html>",
		);
		pagesRepository.insertVersionAndActivate.mockRejectedValue(
			new VersionConflictError(RACED_VERSION_ID),
		);
		vi.mocked(deleteObject).mockRejectedValue(cleanupError);

		const error = await service
			.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ConflictException);
		expect((error as ConflictException).getResponse()).toEqual({
			activeVersionId: RACED_VERSION_ID,
			code: "VERSION_CONFLICT",
		});
		expect(deleteObject).toHaveBeenCalledWith(
			vi.mocked(putPageHtml).mock.calls[0]?.[0],
		);
		expect(loggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to delete orphaned page version object"),
			cleanupError,
		);
		loggerWarn.mockRestore();
	});

	it("returns 404 for an unknown or foreign historical version", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		pagesRepository.findAccessibleVersionById.mockResolvedValue(null);

		await expect(
			service.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("returns 404 when the selected version's object is missing", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(null);

		await expect(
			service.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(pagesRepository.insertVersionAndActivate).not.toHaveBeenCalled();
	});

	it("returns 404 when the authenticated user does not own the project", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findActivePageByProject.mockResolvedValue(null);

		await expect(
			service.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(pagesRepository.findAccessibleVersionById).not.toHaveBeenCalled();
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("returns 404 when an owned version belongs to another project", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			artifactId: ARTIFACT_ID,
			id: RESTORED_VERSION_ID,
			projectId: OTHER_PROJECT_ID,
			r2Key: RESTORED_R2_KEY,
		});

		await expect(
			service.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("returns 404 when an owned version belongs to another artifact", async () => {
		const { pagesRepository, service } = setup();
		mockRestorableVersion(pagesRepository);
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			artifactId: OTHER_ARTIFACT_ID,
			id: RESTORED_VERSION_ID,
			projectId: PROJECT_ID,
			r2Key: RESTORED_R2_KEY,
		});

		await expect(
			service.restoreVersion(SCOPE, PROJECT_ID, RESTORED_VERSION_ID, {
				expectedActiveVersionId: ACTIVE_VERSION_ID,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});
});

describe("PageEditsService.applyAiOps", () => {
	it("rejects an externally hosted image before loading page HTML", async () => {
		const { pagesRepository, service } = setup();
		mockAiActivePage(pagesRepository);
		vi.mocked(isWanditHostedUrl).mockReturnValue(false);

		const result = await service.applyAiOps(PROJECT_ID, [
			{
				kind: "image-src",
				value: "https://external.example.com/generated.png",
				wid: "e-1",
			},
		]);

		expect(result).toEqual({
			message:
				'op 1 (image-src, data-wid="e-1"): image URL must be a Wandit-hosted asset',
			status: "rejected",
		});
		expect(isWanditHostedUrl).toHaveBeenCalledWith(
			"https://external.example.com/generated.png",
		);
		expect(getPageHtml).not.toHaveBeenCalled();
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(pagesRepository.insertVersionAndActivate).not.toHaveBeenCalled();
	});

	it("applies a hosted image as an immutable AI-edit version", async () => {
		const { pagesRepository, service } = setup();
		const imageUrl = "https://assets.example.com/images/generated.png";
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			completeThemeHtml(
				'<section data-wid="hero"><img data-wid="e-1" src="https://assets.example.com/images/old.png"></section>',
			),
		);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});

		const result = await service.applyAiOps(PROJECT_ID, [
			{ kind: "image-src", value: imageUrl, wid: "e-1" },
		]);

		expect(result).toEqual({ status: "applied", versionNumber: 4 });
		expect(isWanditHostedUrl).toHaveBeenCalledWith(imageUrl);
		const savedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		expect(cheerio.load(savedHtml)('[data-wid="e-1"]').attr("src")).toBe(
			imageUrl,
		);
		expect(
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0].meta,
		).toEqual({
			editedWids: ["e-1"],
			ops: [{ kind: "image-src", wid: "e-1" }],
			parentVersionId: ACTIVE_VERSION_ID,
			source: "ai-edit",
		});
	});

	it("adds, preserves, deduplicates, and removes the feature shelf across AI replacements", async () => {
		const { pagesRepository, service } = setup();
		const managedIds = [
			"wandit-feature-toastify-css",
			"wandit-feature-toastify-js",
			"wandit-feature-starter-js",
		];
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValueOnce(completeThemeHtml());
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});

		const added = await service.applyAiOps(PROJECT_ID, [
			{
				kind: "replace-section",
				value:
					'<section data-wid="hero"><button data-wandit-toast="Saved">Save</button></section>',
				wid: "hero",
			},
		]);

		expect(added).toEqual({ status: "applied", versionNumber: 4 });
		const firstSavedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		const firstSavedDom = cheerio.load(firstSavedHtml);
		expect(firstSavedDom('[data-wandit-toast="Saved"]')).toHaveLength(1);
		for (const id of managedIds) {
			expect(firstSavedDom(`#${id}`)).toHaveLength(1);
		}
		expect(firstSavedDom('[id^="wandit-feature-"]')).toHaveLength(3);

		vi.mocked(getPageHtml).mockResolvedValueOnce(firstSavedHtml);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:01:00.000Z"),
			number: 5,
		});

		const persisted = await service.applyAiOps(PROJECT_ID, [
			{
				kind: "replace-section",
				value:
					'<section data-wid="hero"><button data-wandit-toast="Updated">Save again</button></section>',
				wid: "hero",
			},
		]);

		expect(persisted).toEqual({ status: "applied", versionNumber: 5 });
		const secondSavedHtml = vi.mocked(putPageHtml).mock.calls[1]?.[1] ?? "";
		const secondSavedDom = cheerio.load(secondSavedHtml);
		expect(secondSavedDom('[data-wandit-toast="Updated"]')).toHaveLength(1);
		for (const id of managedIds) {
			expect(secondSavedDom(`#${id}`)).toHaveLength(1);
		}
		expect(secondSavedDom('[id^="wandit-feature-"]')).toHaveLength(3);

		vi.mocked(getPageHtml).mockResolvedValueOnce(secondSavedHtml);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:02:00.000Z"),
			number: 6,
		});

		const removed = await service.applyAiOps(PROJECT_ID, [
			{
				kind: "replace-section",
				value:
					'<section data-wid="hero"><button>Save without toast</button></section>',
				wid: "hero",
			},
		]);

		expect(removed).toEqual({ status: "applied", versionNumber: 6 });
		const thirdSavedHtml = vi.mocked(putPageHtml).mock.calls[2]?.[1] ?? "";
		const thirdSavedDom = cheerio.load(thirdSavedHtml);
		expect(thirdSavedDom("[data-wandit-toast]")).toHaveLength(0);
		expect(thirdSavedDom('[id^="wandit-feature-"]')).toHaveLength(0);
	});

	it("re-stamps and activates an inserted section without raw HTML in audit metadata", async () => {
		const { pagesRepository, service } = setup();
		const insertedHtml =
			'<aside data-wid="model-section"><p data-wid="model-copy">Shipping notice</p></aside>';
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			completeThemeHtml(
				'<section data-wid="hero"><p data-wid="e-1">Copy</p></section><section data-wid="reviews"><p data-wid="e-2">Reviews</p></section>',
			),
		);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:30:00.000Z"),
			number: 4,
		});

		const result = await service.applyAiOps(PROJECT_ID, [
			{
				kind: "insert-section",
				position: "before",
				value: insertedHtml,
				wid: "hero",
			},
		]);

		expect(result).toEqual({ status: "applied", versionNumber: 4 });
		const savedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		const $ = cheerio.load(savedHtml);
		const inserted = $("body > aside").first();

		expect(inserted.attr("data-wid")).toMatch(/^sec-\d+$/);
		expect(inserted.find("p").attr("data-wid")).toMatch(/^e-\d+$/);
		expect($('[data-wid="model-section"]').length).toBe(0);
		expect($('[data-wid="model-copy"]').length).toBe(0);
		expect($("body").children().first().is("aside")).toBe(true);
		expect($('[data-wid="hero"]').length).toBe(1);

		const activation =
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0];

		expect(activation).toEqual({
			artifactId: ARTIFACT_ID,
			expectedActiveVersionId: ACTIVE_VERSION_ID,
			meta: {
				editedWids: ["hero"],
				ops: [{ kind: "insert-section", wid: "hero" }],
				parentVersionId: ACTIVE_VERSION_ID,
				source: "ai-edit",
			},
			projectId: PROJECT_ID,
			productSku: ACTIVE_PRODUCT_SKU,
			r2Key: expect.any(String),
			versionId: expect.any(String),
		});
		expect(activation?.versionId).not.toBe(ACTIVE_VERSION_ID);
		expect(putPageHtml).toHaveBeenCalledWith(activation?.r2Key, savedHtml);
		expect(JSON.stringify(activation?.meta)).not.toContain(insertedHtml);
	});

	it("reuses an atomic placement receipt and removes the duplicate upload", async () => {
		const { pagesRepository, service } = setup();
		const imageUrl = "https://assets.example.com/images/generated.png";
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(
			completeThemeHtml(
				'<section data-wid="hero"><img data-wid="e-1" src="https://assets.example.com/images/old.png"></section>',
			),
		);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			existingVersionId: RACED_VERSION_ID,
			number: 4,
		});

		const result = await service.applyAiOps(
			PROJECT_ID,
			[{ kind: "image-src", value: imageUrl, wid: "e-1" }],
			{
				attemptId: IMAGE_GENERATION_ATTEMPT_ID,
				kind: "image-generation-placement",
			},
		);

		expect(result).toEqual({ status: "applied", versionNumber: 4 });
		expect(
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0].receipt,
		).toEqual({
			attemptId: IMAGE_GENERATION_ATTEMPT_ID,
			kind: "image-generation-placement",
		});
		expect(
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0].meta,
		).toEqual({
			editedWids: ["e-1"],
			ops: [{ kind: "image-src", wid: "e-1" }],
			parentVersionId: ACTIVE_VERSION_ID,
			receipt: {
				attemptId: IMAGE_GENERATION_ATTEMPT_ID,
				kind: "image-generation-placement",
			},
			source: "ai-edit",
		});
		const uploadedKey = vi.mocked(putPageHtml).mock.calls[0]?.[0];
		expect(uploadedKey).toEqual(expect.any(String));
		expect(deleteObject).toHaveBeenCalledWith(uploadedKey);
	});

	it("identifies a failed batched op by one-based index, kind, and wid", async () => {
		const { pagesRepository, service } = setup();
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(completeThemeHtml());

		const result = await service.applyAiOps(PROJECT_ID, [
			{ kind: "text", value: "Updated copy", wid: "e-1" },
			{ kind: "element-style", value: { color: "#123456" }, wid: "e-1" },
			{ kind: "element-style", value: { width: "50%" }, wid: "e-1" },
		]);

		expect(result).toEqual({
			message:
				'op 3 (element-style, data-wid="e-1"): width is only supported for <img> elements',
			status: "rejected",
		});
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(pagesRepository.insertVersionAndActivate).not.toHaveBeenCalled();
	});

	it("identifies a failed wid-less op without inventing a target", async () => {
		const { pagesRepository, service } = setup();
		mockAiActivePage(pagesRepository);
		vi.mocked(getPageHtml).mockResolvedValue(completeThemeHtml());

		const result = await service.applyAiOps(PROJECT_ID, [
			{ kind: "reset-tokens" },
		]);

		expect(result).toEqual({
			message:
				"op 1 (reset-tokens): no original theme is available for this page",
			status: "rejected",
		});
	});
});

describe("PageEditsService.applyClientOps", () => {
	it("restamps restored nested brand content with fresh descendant wids", async () => {
		const { pagesRepository, service } = setup();
		const stored = completeThemeHtml(`<header data-wid="hero"><nav>
			<a data-brand="nav" data-wid="e-90" href="/">
				<span data-wid="e-2">Wandit <strong data-wid="legacy-brand">Studio</strong></span>
			</a>
		</nav></header>`);
		mockActivePage(pagesRepository);
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});
		vi.mocked(getPageHtml).mockResolvedValue(stored);

		await service.applyClientOps(SCOPE, PROJECT_ID, {
			baseVersionId: ACTIVE_VERSION_ID,
			ops: [
				{
					kind: "brand-logo",
					value: "https://assets.example.com/uploads/user/logo.png",
					wid: "e-90",
				},
				{ kind: "brand-logo", value: null, wid: "e-90" },
			],
			source: "inline",
		});

		const savedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		const wrapper = cheerio.load(savedHtml)('[data-wid="e-90"]');

		expect(wrapper.text().replace(/\s+/g, " ").trim()).toBe("Wandit Studio");
		expect(wrapper.find('[data-wid="e-2"]')).toHaveLength(0);
		expect(wrapper.find('[data-wid="legacy-brand"]')).toHaveLength(0);
		expect(wrapper.children("span").attr("data-wid")).toMatch(/^e-\d+$/);
		expect(wrapper.children("span").attr("data-wid")).not.toBe("e-2");
		expect(wrapper.find("strong").attr("data-wid")).toBeUndefined();
		expect(wrapper.attr("data-wandit-orig-brand-html")).toBeUndefined();
		expect(wrapper.attr("data-wandit-orig-brand-snapshot")).toBeUndefined();
	});

	it("rejects an externally hosted brand logo before loading page HTML", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		vi.mocked(isWanditHostedUrl).mockReturnValue(false);

		const error = await service
			.applyClientOps(SCOPE, PROJECT_ID, {
				baseVersionId: ACTIVE_VERSION_ID,
				ops: [
					{
						kind: "brand-logo",
						value: "https://external.example.com/logo.png",
						wid: "brand",
					},
				],
				source: "inline",
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(UnprocessableEntityException);
		expect((error as UnprocessableEntityException).getResponse()).toEqual({
			code: "OP_FAILED",
			index: 0,
			reason: "brand logo URL must be a Wandit-hosted asset",
		});
		expect(isWanditHostedUrl).toHaveBeenCalledWith(
			"https://external.example.com/logo.png",
		);
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("resolves reset-tokens from the latest builder-origin version", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		pagesRepository.findLatestBuilderVersion.mockResolvedValue({
			id: "88888888-8888-4888-8888-888888888888",
			r2Key: "sites/project/builder/index.html",
		});
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});
		vi.mocked(getPageHtml).mockImplementation(async (key) =>
			key === "sites/project/builder/index.html"
				? completeThemeHtml()
				: completeThemeHtml().replace("oklch(0.96 0.02 210)", "#ffffff"),
		);

		await service.applyClientOps(SCOPE, PROJECT_ID, {
			baseVersionId: ACTIVE_VERSION_ID,
			ops: [{ kind: "reset-tokens" }],
			source: "theme",
		});

		expect(pagesRepository.findLatestBuilderVersion).toHaveBeenCalledWith(
			ARTIFACT_ID,
		);
		const savedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		expect(savedHtml).toContain("--background: oklch(0.96 0.02 210);");
		expect(savedHtml).toContain(
			'--font-heading: "Editorial Serif", Georgia, serif;',
		);
		expect(savedHtml).toContain(
			"https://fonts.googleapis.com/css2?family=Original+Serif",
		);
		expect(
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0].meta,
		).toMatchObject({
			editedWids: ["__tokens__"],
			ops: [{ kind: "reset-tokens" }],
			source: "theme",
		});
	});

	it("applies reset and element edits atomically with inline source", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		pagesRepository.findLatestBuilderVersion.mockResolvedValue({
			id: "88888888-8888-4888-8888-888888888888",
			r2Key: "sites/project/builder/index.html",
		});
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});
		vi.mocked(getPageHtml).mockImplementation(async (key) =>
			key === "sites/project/builder/index.html"
				? completeThemeHtml()
				: completeThemeHtml().replace("Copy", "Current copy"),
		);

		await service.applyClientOps(SCOPE, PROJECT_ID, {
			baseVersionId: ACTIVE_VERSION_ID,
			ops: [
				{ kind: "text", wid: "e-1", value: "Updated copy" },
				{ kind: "reset-tokens" },
			],
			source: "inline",
		});

		const savedHtml = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		expect(savedHtml).toContain("Updated copy");
		expect(savedHtml).toContain("--background: oklch(0.96 0.02 210);");
		expect(
			pagesRepository.insertVersionAndActivate.mock.calls[0]?.[0].meta,
		).toMatchObject({
			editedWids: ["e-1", "__tokens__"],
			source: "inline",
		});
	});

	it("returns an honest 422 when the original builder theme is unavailable", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		pagesRepository.findLatestBuilderVersion.mockResolvedValue(null);

		const error = await service
			.applyClientOps(SCOPE, PROJECT_ID, {
				baseVersionId: ACTIVE_VERSION_ID,
				ops: [{ kind: "reset-tokens" }],
				source: "theme",
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(UnprocessableEntityException);
		expect((error as UnprocessableEntityException).getResponse()).toEqual({
			code: "OP_FAILED",
			index: 0,
			reason: "no original theme found",
		});
		expect(putPageHtml).not.toHaveBeenCalled();
	});

	it("distinguishes missing original HTML from an incomplete theme", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		pagesRepository.findLatestBuilderVersion.mockResolvedValue({
			id: "88888888-8888-4888-8888-888888888888",
			r2Key: "sites/project/builder/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(null);

		const error = await service
			.applyClientOps(SCOPE, PROJECT_ID, {
				baseVersionId: ACTIVE_VERSION_ID,
				ops: [{ kind: "reset-tokens" }],
				source: "theme",
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(UnprocessableEntityException);
		expect((error as UnprocessableEntityException).getResponse()).toEqual({
			code: "OP_FAILED",
			index: 0,
			reason: "the original version could not be loaded",
		});
		expect(putPageHtml).not.toHaveBeenCalled();
	});

	it("returns an honest 422 when the builder theme is incomplete", async () => {
		const { pagesRepository, service } = setup();
		mockActivePage(pagesRepository);
		pagesRepository.findLatestBuilderVersion.mockResolvedValue({
			id: "88888888-8888-4888-8888-888888888888",
			r2Key: "sites/project/builder/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(
			"<!doctype html><html><head><style>:root { --background: #fff; }</style></head></html>",
		);

		const error = await service
			.applyClientOps(SCOPE, PROJECT_ID, {
				baseVersionId: ACTIVE_VERSION_ID,
				ops: [{ kind: "reset-tokens" }],
				source: "theme",
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(UnprocessableEntityException);
		expect((error as UnprocessableEntityException).getResponse()).toEqual({
			code: "OP_FAILED",
			index: 0,
			reason: "the original page does not declare a complete theme",
		});
		expect(putPageHtml).not.toHaveBeenCalled();
	});

	it("mints identical widened-predicate wids on serve and mutate paths", async () => {
		const { pagesRepository, service } = setup();
		const stored =
			'<!doctype html><html><body><section data-wid="hero"><p data-wid="e-7">Existing</p><span id="first">Price <em>now</em></span><span id="second">Open <strong>daily</strong></span></section></body></html>';
		mockActivePage(pagesRepository);
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			id: ACTIVE_VERSION_ID,
			r2Key: `sites/${PROJECT_ID}/${ACTIVE_VERSION_ID}/index.html`,
		});
		pagesRepository.insertVersionAndActivate.mockResolvedValue({
			createdAt: new Date("2026-07-31T12:00:00.000Z"),
			number: 4,
		});
		vi.mocked(getPageHtml).mockResolvedValue(stored);
		const readService = new PagesService(
			pagesRepository as unknown as PagesRepository,
		);

		const served = await readService.versionHtml(SCOPE, ACTIVE_VERSION_ID);
		await service.applyClientOps(SCOPE, PROJECT_ID, {
			baseVersionId: ACTIVE_VERSION_ID,
			ops: [{ kind: "element-style", wid: "e-7", value: { color: "#123456" } }],
			source: "inline",
		});

		const mutated = vi.mocked(putPageHtml).mock.calls[0]?.[1] ?? "";
		const servedDom = cheerio.load(served.html);
		const mutatedDom = cheerio.load(mutated);
		for (const id of ["first", "second"]) {
			expect(servedDom(`#${id}`).attr("data-wid")).toMatch(/^e-\d+$/);
			expect(mutatedDom(`#${id}`).attr("data-wid")).toBe(
				servedDom(`#${id}`).attr("data-wid"),
			);
		}
		expect(servedDom('p[data-wid="e-7"]')).toHaveLength(1);
		expect(mutatedDom('p[data-wid="e-7"]')).toHaveLength(1);
	});
});
