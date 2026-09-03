import { NotFoundException } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	deleteObject,
	getPageHtml,
	isR2Configured,
	putPageHtml,
	r2ObjectExists,
} from "../../../../infrastructure/storage/r2";
import type { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	NoVersionToPublishError,
	PublishFailedError,
	PublishUnavailableError,
	SiteAssetsUnreachableError,
	SlugReservedError,
	SlugTakenError,
} from "../../domain/errors/site.errors";
import type {
	DeploymentRow,
	DeploymentsRepository,
} from "../../infrastructure/persistence/deployments.repository";
import { SitesService } from "./sites.service";

// R2 is a network dependency — replace the storage module so tests control
// what "the bucket" returns without credentials. The URL/key helpers stay
// real-shaped (the image pass in the publish chain reaches for them through
// this same module) but resolve against a fixed public base.
const ASSETS_BASE = "https://assets.test";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	deleteObject: vi.fn(),
	getPageHtml: vi.fn(),
	isR2Configured: vi.fn(),
	isWanditHostedUrl: (url: string) => url.startsWith(`${ASSETS_BASE}/`),
	publicAssetKeyFromUrl: (url: string) =>
		url.startsWith(`${ASSETS_BASE}/`)
			? url.slice(ASSETS_BASE.length + 1)
			: null,
	publicAssetUrl: (key: string) => `${ASSETS_BASE}/${key}`,
	publishedArchiveKey: (projectId: string, deploymentId: string) =>
		`published/${projectId}/v/${deploymentId}.html`,
	publishedCurrentKey: (projectId: string) =>
		`published/${projectId}/current.html`,
	putPageHtml: vi.fn(),
	r2ObjectExists: vi.fn(),
	VARIANT_FILENAME_PATTERN: /\.w\d+\.webp$/,
	variantKey: (baseKey: string, width: number) =>
		`${baseKey.replace(/\.[^./]+$/, "")}.w${width}.webp`,
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

// Owned by the pages module's CDN-inlining phase; replaced with an identity
// transform so this spec exercises the sites service alone.
const { inlineKnownCdnScriptsMock } = vi.hoisted(() => ({
	inlineKnownCdnScriptsMock: vi.fn((html: string) => html),
}));

vi.mock("../../../pages/domain/inline-cdn-scripts", () => ({
	inlineKnownCdnScripts: inlineKnownCdnScriptsMock,
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FORM_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };

function deploymentRow(overrides: Partial<DeploymentRow> = {}): DeploymentRow {
	return {
		createdAt: new Date("2026-07-25T10:00:00.000Z"),
		error: null,
		id: "33333333-3333-4333-8333-333333333333",
		projectId: PROJECT_ID,
		slug: "smoke-project",
		status: "pending",
		updatedAt: new Date("2026-07-25T10:00:00.000Z"),
		versionId: VERSION_ID,
		...overrides,
	};
}

function setup(options: { kvConfigured?: boolean } = {}) {
	const repository = {
		findActiveByProject: vi.fn().mockResolvedValue(null),
		findById: vi.fn(),
		findCurrent: vi.fn().mockResolvedValue({
			active: null,
			newest: null,
			newestPending: null,
			pendingVersionId: null,
		}),
		findDraftVersion: vi
			.fn()
			.mockResolvedValue({ id: VERSION_ID, r2Key: "sites/p/v/index.html" }),
		findVersionForProject: vi.fn(),
		getAccessibleProject: vi.fn().mockResolvedValue({
			hideWanditBadge: false,
			id: PROJECT_ID,
			metaPixelId: null,
			name: "Smoke Project",
			ownerIsEntitled: false,
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		}),
		healStalePending: vi.fn().mockResolvedValue(undefined),
		insertPending: vi.fn().mockResolvedValue(deploymentRow()),
		isSlugTakenByOther: vi.fn().mockResolvedValue(false),
		listByProject: vi.fn().mockResolvedValue([]),
		markFailed: vi.fn().mockResolvedValue(null),
		promoteToActive: vi
			.fn()
			.mockResolvedValue(deploymentRow({ status: "active" })),
		unpublishActive: vi.fn().mockResolvedValue(null),
	};
	const routing = {
		deleteHostPointer: vi.fn().mockResolvedValue(undefined),
		isKvConfigured: vi.fn().mockReturnValue(options.kvConfigured ?? true),
		putHostPointer: vi.fn().mockResolvedValue(undefined),
	};
	const analytics = {
		capture: vi.fn(),
	};
	const service = new SitesService(
		repository as unknown as DeploymentsRepository,
		routing as unknown as DomainRoutingService,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, repository, routing, service };
}

function mockLoggerError(service: SitesService): ReturnType<typeof vi.fn> {
	const error = vi.fn();
	(
		service as unknown as {
			logger: { error: (...args: unknown[]) => void };
		}
	).logger.error = error;

	return error;
}

beforeEach(() => {
	delete (env as { ALLOW_PUBLISH_WITHOUT_KV?: boolean })
		.ALLOW_PUBLISH_WITHOUT_KV;
	delete (env as { SITE_PUBLISH_ASSET_CHECK?: boolean })
		.SITE_PUBLISH_ASSET_CHECK;
	inlineKnownCdnScriptsMock
		.mockReset()
		.mockImplementation((html: string) => html);
	vi.mocked(deleteObject).mockReset().mockResolvedValue(undefined);
	vi.mocked(getPageHtml)
		.mockReset()
		.mockResolvedValue("<!doctype html><html><body>Hi</body></html>");
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putPageHtml).mockReset().mockResolvedValue(undefined);
	vi.mocked(r2ObjectExists).mockReset().mockResolvedValue(false);
});

describe("SitesService.publish", () => {
	it("publishes the draft version: archive + current written before promote", async () => {
		const { analytics, repository, routing, service } = setup();
		const calls: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (key) => {
			calls.push(`put:${key}`);
		});
		routing.putHostPointer.mockImplementation(async () => {
			calls.push("pointer");
		});
		repository.promoteToActive.mockImplementation(async () => {
			calls.push("promote");

			return deploymentRow({ status: "active" });
		});

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(calls).toEqual([
			`put:published/${PROJECT_ID}/v/33333333-3333-4333-8333-333333333333.html`,
			`put:published/${PROJECT_ID}/current.html`,
			"pointer",
			"promote",
		]);
		expect(analytics.capture).toHaveBeenCalledOnce();
		expect(analytics.capture).toHaveBeenCalledWith(USER_ID, "site_published", {
			projectId: PROJECT_ID,
		});
	});

	it("503s before publish mutation when Cloudflare KV is unconfigured", async () => {
		const { analytics, repository, routing, service } = setup({
			kvConfigured: false,
		});
		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(PublishUnavailableError);
		expect((thrown as PublishUnavailableError).getStatus()).toBe(503);
		expect((thrown as PublishUnavailableError).getResponse()).toEqual({
			code: "PUBLISH_UNAVAILABLE",
			message:
				"Cloudflare KV is not configured; publishing cannot make the site reachable",
		});
		expect(repository.insertPending).not.toHaveBeenCalled();
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(repository.promoteToActive).not.toHaveBeenCalled();
		expect(repository.markFailed).not.toHaveBeenCalled();
		expect(routing.putHostPointer).not.toHaveBeenCalled();
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("allows API-only local publish without KV when explicitly enabled", async () => {
		(env as { ALLOW_PUBLISH_WITHOUT_KV: boolean }).ALLOW_PUBLISH_WITHOUT_KV =
			true;
		const { repository, routing, service } = setup({ kvConfigured: false });

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(routing.putHostPointer).not.toHaveBeenCalled();
		expect(repository.promoteToActive).toHaveBeenCalledOnce();
	});

	it("writes the slug pointer on first publish when KV is configured", async () => {
		const { repository, routing, service } = setup({ kvConfigured: true });

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(routing.putHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
			{ projectId: PROJECT_ID, slug: "smoke-project", source: "slug" },
		);
		expect(repository.promoteToActive).toHaveBeenCalledOnce();
	});

	it("rewrites the slug pointer even when republishing under the same slug", async () => {
		// One idempotent PUT per publish, always: skipping it when the slug is
		// unchanged strands sites whose first publish ran before Cloudflare
		// credentials existed (the pointer would never be written at all).
		const { repository, routing, service } = setup({ kvConfigured: true });
		repository.findActiveByProject.mockResolvedValue(
			deploymentRow({ slug: "smoke-project", status: "active" }),
		);

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(routing.putHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
			{ projectId: PROJECT_ID, slug: "smoke-project", source: "slug" },
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});

	it("on slug change writes the new pointer and deletes the old one after promote", async () => {
		const { repository, routing, service } = setup({ kvConfigured: true });
		repository.findActiveByProject.mockResolvedValue(
			deploymentRow({ slug: "old-slug", status: "active" }),
		);
		repository.insertPending.mockResolvedValue(
			deploymentRow({ slug: "new-slug" }),
		);
		repository.promoteToActive.mockResolvedValue(
			deploymentRow({ slug: "new-slug", status: "active" }),
		);

		await service.publish(SCOPE, PROJECT_ID, { slug: "new-slug" });

		expect(routing.putHostPointer).toHaveBeenCalledWith(
			"new-slug.wandit.app",
			expect.objectContaining({ source: "slug" }),
		);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"old-slug.wandit.app",
		);
	});

	it("rejects a slug already live on another project before any R2 write", async () => {
		const { repository, service } = setup();
		repository.isSlugTakenByOther.mockResolvedValue(true);

		await expect(
			service.publish(SCOPE, PROJECT_ID, { slug: "taken" }),
		).rejects.toBeInstanceOf(SlugTakenError);
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(repository.insertPending).not.toHaveBeenCalled();
	});

	it("rejects reserved slugs", async () => {
		const { repository, service } = setup();

		await expect(
			service.publish(SCOPE, PROJECT_ID, { slug: "customers" }),
		).rejects.toBeInstanceOf(SlugReservedError);
		expect(repository.insertPending).not.toHaveBeenCalled();
	});

	it("422s when the project has no version to publish", async () => {
		const { repository, service } = setup();
		repository.findDraftVersion.mockResolvedValue(null);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			NoVersionToPublishError,
		);
	});

	it("503s when R2 is unconfigured", async () => {
		const { service } = setup();
		vi.mocked(isR2Configured).mockReturnValue(false);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishUnavailableError,
		);
	});

	it("marks the pending row failed and rethrows typed when R2 write fails", async () => {
		const { analytics, repository, service } = setup();
		vi.mocked(putPageHtml).mockRejectedValue(new Error("R2 exploded"));

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);
		expect(repository.markFailed).toHaveBeenCalledWith(
			"33333333-3333-4333-8333-333333333333",
			expect.stringContaining("R2 exploded"),
		);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("injects pixels into the published bytes when the project has them", async () => {
		const { repository, service } = setup();
		repository.getAccessibleProject.mockResolvedValue({
			id: PROJECT_ID,
			metaPixelId: "1234567890",
			name: "Smoke Project",
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		});
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toContain('data-wandit-pixel="meta"');
		expect(bodies[0]).toContain("1234567890");
	});

	it("injects the leads capture runtime into the published bytes", async () => {
		const { repository, service } = setup();
		const pendingId = "55555555-5555-4555-8555-555555555555";
		repository.insertPending.mockResolvedValue(
			deploymentRow({ id: pendingId }),
		);
		repository.promoteToActive.mockResolvedValue(
			deploymentRow({
				id: pendingId,
				status: "active",
			}),
		);
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies[0]).toContain('id="wandit-leads-runtime"');
		expect(bodies[0]).toContain(`/api/public/leads/${FORM_ID}`);
		expect(bodies[0]).toContain(JSON.stringify(pendingId));
	});

	it("injects the Made with Wandit badge into every free publish", async () => {
		const { service } = setup();
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toContain('id="wandit-badge"');
		expect(bodies[1]).toContain('id="wandit-badge"');
	});

	it("runs the CDN inliner on the draft bytes before injection", async () => {
		const { service } = setup();
		inlineKnownCdnScriptsMock.mockImplementation((html: string) =>
			html.replace(
				"<body>",
				'<body><script data-wandit-vendored="gsap"></script>',
			),
		);
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(inlineKnownCdnScriptsMock).toHaveBeenCalledWith(
			"<!doctype html><html><body>Hi</body></html>",
		);
		expect(bodies[0]).toContain('data-wandit-vendored="gsap"');
		expect(bodies[1]).toContain('data-wandit-vendored="gsap"');
	});

	// The image pass sits between the font pass and the injectors, so its
	// output is what the preflight probes and what BOTH R2 writes receive.
	it("normalizes image markup and emits a verified srcset before injection", async () => {
		const { service } = setup();
		// The preflight has its own describe block; this test is about the
		// transform chain, so the network probe stays off.
		(env as { SITE_PUBLISH_ASSET_CHECK?: boolean }).SITE_PUBLISH_ASSET_CHECK =
			false;
		const hero = "https://assets.test/sites/p/a/img-1.webp";
		vi.mocked(getPageHtml).mockResolvedValue(
			"<!doctype html><html><head></head><body>" +
				'<header><img data-wandit-brand-image src="/logo.png" alt="Brand"></header>' +
				`<section><img src="${hero}" alt="Hero" width="1536" height="1024"></section>` +
				'<section><img src="/late.png" alt="Late" loading="eager"></section>' +
				"</body></html>",
		);
		vi.mocked(r2ObjectExists).mockImplementation(
			async (key) => key === "sites/p/a/img-1.w960.webp",
		);
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies[0]).toContain('fetchpriority="high"');
		expect(bodies[0]?.match(/fetchpriority="high"/g)).toHaveLength(1);
		expect(bodies[0]).toContain('loading="lazy"');
		expect(bodies[0]).toContain(
			`srcset="https://assets.test/sites/p/a/img-1.w960.webp 960w, ${hero} 1920w"`,
		);
		expect(bodies[0]).toContain('rel="preload" as="image"');
		// Archive and current must be the same string (rollback replays it).
		expect(bodies[1]).toBe(bodies[0]);
	});

	it("keeps the badge when a FREE owner sets the hide toggle", async () => {
		const { repository, service } = setup();
		repository.getAccessibleProject.mockResolvedValue({
			hideWanditBadge: true,
			id: PROJECT_ID,
			metaPixelId: null,
			name: "Smoke Project",
			ownerIsEntitled: false,
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		});
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies[0]).toContain('id="wandit-badge"');
	});

	it("hides the badge when an ENTITLED owner sets the hide toggle", async () => {
		const { repository, service } = setup();
		repository.getAccessibleProject.mockResolvedValue({
			hideWanditBadge: true,
			id: PROJECT_ID,
			metaPixelId: null,
			name: "Smoke Project",
			ownerIsEntitled: true,
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		});
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(SCOPE, PROJECT_ID, {});

		expect(bodies[0]).not.toContain('id="wandit-badge"');
		// The rest of the publish transform chain is untouched.
		expect(bodies[0]).toContain('id="wandit-leads-runtime"');
	});
});

describe("SitesService.publish compensation", () => {
	const ACTIVE_ID = "66666666-6666-4666-8666-666666666666";
	const CONCURRENT_ACTIVE_ID = "77777777-7777-4777-8777-777777777777";
	const DRAFT_HTML = "<!doctype html><html><body>new</body></html>";
	const PREVIOUS_HTML = "<!doctype html><html><body>previous</body></html>";
	const CONCURRENT_HTML = "<!doctype html><html><body>winner</body></html>";

	function previousActive(slug = "smoke-project"): DeploymentRow {
		return deploymentRow({ id: ACTIVE_ID, slug, status: "active" });
	}

	it("restores previous live bytes when a same-slug pointer write fails", async () => {
		const { repository, routing, service } = setup();
		repository.findActiveByProject.mockResolvedValue(previousActive());
		routing.putHostPointer.mockRejectedValue(new Error("KV exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(PREVIOUS_HTML);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);

		expect(getPageHtml).toHaveBeenNthCalledWith(
			2,
			`published/${PROJECT_ID}/v/${ACTIVE_ID}.html`,
		);
		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			PREVIOUS_HTML,
		);
		expect(putPageHtml).toHaveBeenCalledTimes(3);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
		expect(repository.markFailed).toHaveBeenCalledOnce();
	});

	it("restores previous live bytes when promotion fails", async () => {
		const { repository, routing, service } = setup();
		repository.findActiveByProject.mockResolvedValue(previousActive());
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(PREVIOUS_HTML);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);

		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			PREVIOUS_HTML,
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
		expect(repository.markFailed).toHaveBeenCalledOnce();
	});

	it("restores previous live bytes when marking the failed deployment also fails", async () => {
		const { repository, service } = setup();
		const loggerError = mockLoggerError(service);
		const calls: string[] = [];
		const markFailedError = new Error("mark failed exploded");
		repository.findActiveByProject.mockResolvedValue(previousActive());
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		repository.markFailed.mockImplementation(async () => {
			calls.push("markFailed");
			throw markFailedError;
		});
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockImplementationOnce(async () => {
				calls.push("restore");

				return PREVIOUS_HTML;
			});

		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(PublishFailedError);
		expect(thrown).not.toBe(markFailedError);
		expect((thrown as PublishFailedError).getResponse()).toEqual({
			code: "PUBLISH_FAILED",
			message: "DB exploded",
		});
		expect(calls).toEqual(["restore", "markFailed"]);
		expect(getPageHtml).toHaveBeenNthCalledWith(
			2,
			`published/${PROJECT_ID}/v/${ACTIVE_ID}.html`,
		);
		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			PREVIOUS_HTML,
		);
		expect(loggerError).toHaveBeenCalledWith(
			`Publish failure state could not be recorded for deployment ${deploymentRow().id}`,
			expect.stringContaining("mark failed exploded"),
		);
	});

	it("restores the concurrent active deployment resolved after the flip", async () => {
		const { repository, routing, service } = setup();
		const concurrentActive = deploymentRow({
			id: CONCURRENT_ACTIVE_ID,
			status: "active",
		});
		repository.findActiveByProject
			.mockResolvedValue(concurrentActive)
			.mockResolvedValueOnce(previousActive());
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(CONCURRENT_HTML);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);

		expect(getPageHtml).toHaveBeenNthCalledWith(
			2,
			`published/${PROJECT_ID}/v/${CONCURRENT_ACTIVE_ID}.html`,
		);
		expect(getPageHtml).not.toHaveBeenCalledWith(
			`published/${PROJECT_ID}/v/${ACTIVE_ID}.html`,
		);
		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			CONCURRENT_HTML,
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});

	it("falls back to the active snapshot when restore re-resolution fails", async () => {
		const { repository, routing, service } = setup();
		repository.findActiveByProject
			.mockRejectedValue(new Error("DB unavailable"))
			.mockResolvedValueOnce(previousActive());
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(PREVIOUS_HTML);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);

		expect(getPageHtml).toHaveBeenNthCalledWith(
			2,
			`published/${PROJECT_ID}/v/${ACTIVE_ID}.html`,
		);
		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			PREVIOUS_HTML,
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});

	it("deletes only the new slug pointer when changed-slug promotion fails", async () => {
		const { repository, routing, service } = setup();
		repository.findActiveByProject.mockResolvedValue(
			previousActive("old-slug"),
		);
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(PREVIOUS_HTML);

		await expect(
			service.publish(SCOPE, PROJECT_ID, { slug: "new-slug" }),
		).rejects.toBeInstanceOf(PublishFailedError);

		expect(putPageHtml).toHaveBeenLastCalledWith(
			`published/${PROJECT_ID}/current.html`,
			PREVIOUS_HTML,
		);
		expect(routing.deleteHostPointer).toHaveBeenCalledOnce();
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"new-slug.wandit.app",
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalledWith(
			"old-slug.wandit.app",
		);
	});

	it("removes live bytes and the new pointer when a first publish fails after the flip", async () => {
		const { repository, routing, service } = setup();
		repository.promoteToActive.mockRejectedValue(new Error("DB exploded"));
		vi.mocked(getPageHtml).mockResolvedValueOnce(DRAFT_HTML);

		await expect(service.publish(SCOPE, PROJECT_ID, {})).rejects.toBeInstanceOf(
			PublishFailedError,
		);

		expect(deleteObject).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/current.html`,
		);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
		);
	});

	it("keeps the new live bytes when the previous archive is missing", async () => {
		const { repository, routing, service } = setup();
		const loggerError = mockLoggerError(service);
		repository.findActiveByProject.mockResolvedValue(previousActive());
		routing.putHostPointer.mockRejectedValue(new Error("KV exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockRejectedValueOnce(new Error("archive missing"));

		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(PublishFailedError);
		expect((thrown as PublishFailedError).getResponse()).toEqual({
			code: "PUBLISH_FAILED",
			message: "KV exploded",
		});
		expect(putPageHtml).toHaveBeenCalledTimes(2);
		expect(loggerError).toHaveBeenCalledWith(
			`Publish compensation could not read archived bytes for deployment ${ACTIVE_ID}`,
		);
	});

	it("preserves the original error when restoring live bytes fails", async () => {
		const { repository, routing, service } = setup();
		const loggerError = mockLoggerError(service);
		repository.findActiveByProject.mockResolvedValue(previousActive());
		routing.putHostPointer.mockRejectedValue(new Error("KV exploded"));
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(DRAFT_HTML)
			.mockResolvedValueOnce(PREVIOUS_HTML);
		vi.mocked(putPageHtml)
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("restore exploded"));

		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(PublishFailedError);
		expect((thrown as PublishFailedError).getResponse()).toEqual({
			code: "PUBLISH_FAILED",
			message: "KV exploded",
		});
		expect(loggerError).toHaveBeenCalledWith(
			`Publish compensation failed for project ${PROJECT_ID}`,
			expect.stringContaining("restore exploded"),
		);
	});

	it("does not restore after promotion when old-slug cleanup fails", async () => {
		const { repository, routing, service } = setup();
		repository.findActiveByProject.mockResolvedValue(
			previousActive("old-slug"),
		);
		routing.deleteHostPointer.mockRejectedValue(
			new Error("KV delete exploded"),
		);
		vi.mocked(getPageHtml).mockResolvedValueOnce(DRAFT_HTML);

		await expect(
			service.publish(SCOPE, PROJECT_ID, { slug: "new-slug" }),
		).rejects.toBeInstanceOf(PublishFailedError);

		expect(repository.promoteToActive).toHaveBeenCalledOnce();
		expect(getPageHtml).toHaveBeenCalledTimes(1);
		expect(putPageHtml).toHaveBeenCalledTimes(2);
		expect(routing.deleteHostPointer).toHaveBeenCalledTimes(1);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"old-slug.wandit.app",
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalledWith(
			"new-slug.wandit.app",
		);
	});
});

describe("SitesService.publish asset preflight", () => {
	type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function draftWith(bodyHtml: string): void {
		vi.mocked(getPageHtml).mockResolvedValue(
			`<!doctype html><html><head></head><body>${bodyHtml}</body></html>`,
		);
	}

	function requestedUrls(): string[] {
		return fetchMock.mock.calls.map(([input]) =>
			typeof input === "string"
				? input
				: input instanceof URL
					? input.toString()
					: input.url,
		);
	}

	it("probes each unique absolute asset once with HEAD and publishes", async () => {
		const { repository, service } = setup();
		draftWith(
			'<img src="https://cdn.test/a.png"><img src="https://cdn.test/a.png">' +
				'<video src="https://cdn.test/v.mp4" poster="https://cdn.test/p.jpg"></video>',
		);
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(requestedUrls().sort()).toEqual([
			"https://cdn.test/a.png",
			"https://cdn.test/p.jpg",
			"https://cdn.test/v.mp4",
		]);
		expect(
			fetchMock.mock.calls.every(([, init]) => init?.method === "HEAD"),
		).toBe(true);
		expect(repository.promoteToActive).toHaveBeenCalledOnce();
	});

	it("422s listing the broken URLs when an asset 404s, before any R2 write", async () => {
		const { repository, service } = setup();
		draftWith(
			'<img src="https://cdn.test/ok.png"><img src="https://cdn.test/gone.png">',
		);
		fetchMock.mockImplementation(async (input) => {
			const status = String(input).includes("gone") ? 404 : 200;

			return new Response(null, { status });
		});
		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(SiteAssetsUnreachableError);
		expect((thrown as SiteAssetsUnreachableError).getStatus()).toBe(422);
		expect((thrown as SiteAssetsUnreachableError).getResponse()).toEqual({
			code: "ASSETS_UNREACHABLE",
			message: expect.stringContaining("https://cdn.test/gone.png"),
		});
		expect((thrown as SiteAssetsUnreachableError).brokenUrls).toEqual([
			"https://cdn.test/gone.png",
		]);
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(repository.promoteToActive).not.toHaveBeenCalled();
		expect(repository.markFailed).toHaveBeenCalledOnce();
	});

	it("hard-fails relative and root-relative URLs without probing the network", async () => {
		const { service } = setup();
		draftWith('<img src="images/a.png"><img src="/img/b.png">');
		let thrown: unknown;

		try {
			await service.publish(SCOPE, PROJECT_ID, {});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(SiteAssetsUnreachableError);
		expect((thrown as SiteAssetsUnreachableError).brokenUrls).toEqual([
			"images/a.png",
			"/img/b.png",
		]);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(putPageHtml).not.toHaveBeenCalled();
	});

	it("publishes with a warning when probes time out or 5xx", async () => {
		const { repository, service } = setup();
		draftWith(
			'<img src="https://cdn.test/slow.png"><img src="https://cdn.test/flaky.png">',
		);
		fetchMock.mockImplementation(async (input) => {
			if (String(input).includes("slow")) {
				throw new DOMException("The operation timed out", "TimeoutError");
			}

			return new Response(null, { status: 503 });
		});

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(putPageHtml).toHaveBeenCalledTimes(2);
		expect(repository.markFailed).not.toHaveBeenCalled();
	});

	it("falls back to GET when the host rejects HEAD", async () => {
		const { service } = setup();
		draftWith('<img src="https://cdn.test/a.png">');
		fetchMock
			.mockResolvedValueOnce(new Response(null, { status: 405 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
		expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("GET");
	});

	it("parses srcset candidates and passes data: URIs without probing", async () => {
		const { service } = setup();
		draftWith(
			'<img src="data:image/png;base64,AAA" srcset="https://cdn.test/a-1x.png 1x, https://cdn.test/a-2x.png 2x">' +
				'<picture><source srcset="https://cdn.test/a-2x.png 2x"></picture>',
		);
		fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(requestedUrls().sort()).toEqual([
			"https://cdn.test/a-1x.png",
			"https://cdn.test/a-2x.png",
		]);
	});

	it("skips the whole preflight when SITE_PUBLISH_ASSET_CHECK is false", async () => {
		(env as { SITE_PUBLISH_ASSET_CHECK?: boolean }).SITE_PUBLISH_ASSET_CHECK =
			false;
		const { service } = setup();
		draftWith('<img src="/broken/relative.png">');

		const result = await service.publish(SCOPE, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("SitesService.unpublish", () => {
	it("frees the slug, deletes current.html and the slug pointer", async () => {
		const { repository, routing, service } = setup({ kvConfigured: true });
		repository.unpublishActive.mockResolvedValue(
			deploymentRow({ slug: "smoke-project", status: "unpublished" }),
		);

		await service.unpublish(SCOPE, PROJECT_ID);

		expect(deleteObject).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/current.html`,
		);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
		);
	});

	it("is a no-op when nothing is live", async () => {
		const { routing, service } = setup({ kvConfigured: true });

		await service.unpublish(SCOPE, PROJECT_ID);

		expect(deleteObject).not.toHaveBeenCalled();
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});

	it("still unpublishes when missing KV prevents pointer cleanup", async () => {
		const { repository, routing, service } = setup({ kvConfigured: false });
		repository.unpublishActive.mockResolvedValue(
			deploymentRow({ slug: "smoke-project", status: "unpublished" }),
		);

		await expect(service.unpublish(SCOPE, PROJECT_ID)).resolves.toEqual({
			current: expect.objectContaining({ uiState: "draft" }),
		});
		expect(deleteObject).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/current.html`,
		);
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});
});

describe("SitesService.rollback", () => {
	it("leaves an archived unrecognized pixel carrier untouched", async () => {
		const { analytics, repository, service } = setup();
		const target = deploymentRow({
			id: "44444444-4444-4444-8444-444444444444",
			status: "superseded",
		});
		repository.findById.mockResolvedValue(target);
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body>archived<script data-wandit-pixel="meta"></script></body></html>',
		);
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.rollback(SCOPE, PROJECT_ID, {
			deploymentId: target.id,
		});

		expect(vi.mocked(getPageHtml)).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/v/${target.id}.html`,
		);
		expect(bodies[0]).toContain('<script data-wandit-pixel="meta"></script>');
		expect(bodies[0]?.match(/data-wandit-pixel/g)).toHaveLength(1);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("restamps a canonical archived pixel with the current project id", async () => {
		const { repository, service } = setup();
		const target = deploymentRow({
			id: "44444444-4444-4444-8444-444444444444",
			status: "superseded",
		});
		repository.findById.mockResolvedValue(target);
		repository.getAccessibleProject.mockResolvedValue({
			hideWanditBadge: false,
			id: PROJECT_ID,
			metaPixelId: "777",
			name: "Smoke Project",
			ownerIsEntitled: false,
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		});
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><head><script data-wandit-pixel="meta">!function(f,b,e,v,n,t,s,c,q,r,p){f.oldPixel="111"}()</script></head><body>archived</body></html>',
		);
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.rollback(SCOPE, PROJECT_ID, {
			deploymentId: target.id,
		});

		expect(bodies[0]).not.toContain("111");
		expect(bodies[0]?.match(/fbq\('init','777'\)/g)).toHaveLength(1);
	});

	it("falls back to draft bytes + injection when the archive is missing", async () => {
		const { repository, service } = setup();
		const target = deploymentRow({
			id: "44444444-4444-4444-8444-444444444444",
			status: "superseded",
		});
		repository.findById.mockResolvedValue(target);
		repository.findVersionForProject.mockResolvedValue({
			id: VERSION_ID,
			r2Key: "sites/p/v/index.html",
		});
		repository.getAccessibleProject.mockResolvedValue({
			id: PROJECT_ID,
			metaPixelId: "777",
			name: "Smoke Project",
			publicFormId: FORM_ID,
			tiktokPixelId: null,
		});
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(null) // archive miss
			.mockResolvedValueOnce("<html><body>draft</body></html>");
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.rollback(SCOPE, PROJECT_ID, {
			deploymentId: target.id,
		});

		expect(bodies[0]).toContain('data-wandit-pixel="meta"');
	});

	it("404s on a deployment from another project", async () => {
		const { repository, service } = setup();
		repository.findById.mockResolvedValue(null);

		await expect(
			service.rollback(SCOPE, PROJECT_ID, {
				deploymentId: "44444444-4444-4444-8444-444444444444",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("SitesService.current uiState mapping", () => {
	const matrix = [
		{
			expected: "publishing",
			rows: {
				active: null,
				newest: deploymentRow(),
				newestPending: deploymentRow(),
				pendingVersionId: VERSION_ID,
			},
		},
		{
			expected: "published",
			rows: {
				active: deploymentRow({ status: "active" }),
				newest: deploymentRow({ status: "active" }),
				newestPending: null,
				pendingVersionId: VERSION_ID,
			},
		},
		{
			expected: "failed",
			rows: {
				active: null,
				newest: deploymentRow({ error: "boom", status: "failed" }),
				newestPending: null,
				pendingVersionId: VERSION_ID,
			},
		},
		{
			expected: "draft",
			rows: {
				active: null,
				newest: deploymentRow({ status: "unpublished" }),
				newestPending: null,
				pendingVersionId: VERSION_ID,
			},
		},
		{
			expected: "draft",
			rows: {
				active: null,
				newest: null,
				newestPending: null,
				pendingVersionId: null,
			},
		},
	] as const;

	for (const { expected, rows } of matrix) {
		it(`maps to ${expected} (${rows.newest?.status ?? "no rows"})`, async () => {
			const { repository, service } = setup();
			repository.findCurrent.mockResolvedValue(rows);

			const { current } = await service.current(SCOPE, PROJECT_ID);

			expect(current.uiState).toBe(expected);

			if (expected === "published") {
				expect(current.liveUrl).toBe("https://smoke-project.wandit.app");
				expect(current.publishedAt).toBe("2026-07-25T10:00:00.000Z");
			} else {
				expect(current.liveUrl).toBeNull();
			}

			if (expected === "failed") {
				expect(current.error).toBe("boom");
			}
		});
	}
});

describe("SitesService.slugAvailability", () => {
	it("flags reserved, taken, and available slugs", async () => {
		const { repository, service } = setup();

		await expect(
			service.slugAvailability(SCOPE, PROJECT_ID, "customers"),
		).resolves.toEqual({
			available: false,
			reason: "reserved",
			slug: "customers",
		});

		repository.isSlugTakenByOther.mockResolvedValue(true);
		await expect(
			service.slugAvailability(SCOPE, PROJECT_ID, "acme"),
		).resolves.toEqual({ available: false, reason: "taken", slug: "acme" });

		repository.isSlugTakenByOther.mockResolvedValue(false);
		await expect(
			service.slugAvailability(SCOPE, PROJECT_ID, "acme"),
		).resolves.toEqual({ available: true, reason: null, slug: "acme" });
	});
});
