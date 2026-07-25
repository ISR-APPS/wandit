import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	deleteObject,
	getPageHtml,
	isR2Configured,
	putPageHtml,
} from "../../../../infrastructure/storage/r2";
import type { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import {
	NoVersionToPublishError,
	PublishFailedError,
	PublishUnavailableError,
	SlugReservedError,
	SlugTakenError,
} from "../../domain/errors/site.errors";
import type {
	DeploymentRow,
	DeploymentsRepository,
} from "../../infrastructure/persistence/deployments.repository";
import { SitesService } from "./sites.service";

// R2 is a network dependency — replace the storage module so tests control
// what "the bucket" returns without credentials.
vi.mock("../../../../infrastructure/storage/r2", () => ({
	deleteObject: vi.fn(),
	getPageHtml: vi.fn(),
	isR2Configured: vi.fn(),
	publishedArchiveKey: (projectId: string, deploymentId: string) =>
		`published/${projectId}/v/${deploymentId}.html`,
	publishedCurrentKey: (projectId: string) =>
		`published/${projectId}/current.html`,
	putPageHtml: vi.fn(),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";

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
		getOwnedProject: vi.fn().mockResolvedValue({
			id: PROJECT_ID,
			metaPixelId: null,
			name: "Smoke Project",
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
		isKvConfigured: vi.fn().mockReturnValue(options.kvConfigured ?? false),
		putHostPointer: vi.fn().mockResolvedValue(undefined),
	};
	const service = new SitesService(
		repository as unknown as DeploymentsRepository,
		routing as unknown as DomainRoutingService,
	);

	return { repository, routing, service };
}

beforeEach(() => {
	vi.mocked(deleteObject).mockReset().mockResolvedValue(undefined);
	vi.mocked(getPageHtml)
		.mockReset()
		.mockResolvedValue("<!doctype html><html><body>Hi</body></html>");
	vi.mocked(isR2Configured).mockReset().mockReturnValue(true);
	vi.mocked(putPageHtml).mockReset().mockResolvedValue(undefined);
});

describe("SitesService.publish", () => {
	it("publishes the draft version: archive + current written before promote", async () => {
		const { repository, service } = setup();
		const calls: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (key) => {
			calls.push(`put:${key}`);
		});
		repository.promoteToActive.mockImplementation(async () => {
			calls.push("promote");

			return deploymentRow({ status: "active" });
		});

		const result = await service.publish(USER_ID, PROJECT_ID, {});

		expect(result.deployment.status).toBe("active");
		expect(calls).toEqual([
			`put:published/${PROJECT_ID}/v/33333333-3333-4333-8333-333333333333.html`,
			`put:published/${PROJECT_ID}/current.html`,
			"promote",
		]);
	});

	it("skips the KV pointer with a warning when Cloudflare is unconfigured", async () => {
		const { routing, service } = setup({ kvConfigured: false });

		await service.publish(USER_ID, PROJECT_ID, {});

		expect(routing.putHostPointer).not.toHaveBeenCalled();
	});

	it("writes the slug pointer on first publish when KV is configured", async () => {
		const { routing, service } = setup({ kvConfigured: true });

		await service.publish(USER_ID, PROJECT_ID, {});

		expect(routing.putHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
			{ projectId: PROJECT_ID, slug: "smoke-project", source: "slug" },
		);
	});

	it("rewrites the slug pointer even when republishing under the same slug", async () => {
		// One idempotent PUT per publish, always: skipping it when the slug is
		// unchanged strands sites whose first publish ran before Cloudflare
		// credentials existed (the pointer would never be written at all).
		const { repository, routing, service } = setup({ kvConfigured: true });
		repository.findActiveByProject.mockResolvedValue(
			deploymentRow({ slug: "smoke-project", status: "active" }),
		);

		await service.publish(USER_ID, PROJECT_ID, {});

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

		await service.publish(USER_ID, PROJECT_ID, { slug: "new-slug" });

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
			service.publish(USER_ID, PROJECT_ID, { slug: "taken" }),
		).rejects.toBeInstanceOf(SlugTakenError);
		expect(putPageHtml).not.toHaveBeenCalled();
		expect(repository.insertPending).not.toHaveBeenCalled();
	});

	it("rejects reserved slugs", async () => {
		const { repository, service } = setup();

		await expect(
			service.publish(USER_ID, PROJECT_ID, { slug: "customers" }),
		).rejects.toBeInstanceOf(SlugReservedError);
		expect(repository.insertPending).not.toHaveBeenCalled();
	});

	it("422s when the project has no version to publish", async () => {
		const { repository, service } = setup();
		repository.findDraftVersion.mockResolvedValue(null);

		await expect(
			service.publish(USER_ID, PROJECT_ID, {}),
		).rejects.toBeInstanceOf(NoVersionToPublishError);
	});

	it("503s when R2 is unconfigured", async () => {
		const { service } = setup();
		vi.mocked(isR2Configured).mockReturnValue(false);

		await expect(
			service.publish(USER_ID, PROJECT_ID, {}),
		).rejects.toBeInstanceOf(PublishUnavailableError);
	});

	it("marks the pending row failed and rethrows typed when R2 write fails", async () => {
		const { repository, service } = setup();
		vi.mocked(putPageHtml).mockRejectedValue(new Error("R2 exploded"));

		await expect(
			service.publish(USER_ID, PROJECT_ID, {}),
		).rejects.toBeInstanceOf(PublishFailedError);
		expect(repository.markFailed).toHaveBeenCalledWith(
			"33333333-3333-4333-8333-333333333333",
			expect.stringContaining("R2 exploded"),
		);
	});

	it("injects pixels into the published bytes when the project has them", async () => {
		const { repository, service } = setup();
		repository.getOwnedProject.mockResolvedValue({
			id: PROJECT_ID,
			metaPixelId: "1234567890",
			name: "Smoke Project",
			tiktokPixelId: null,
		});
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.publish(USER_ID, PROJECT_ID, {});

		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toContain('data-wandit-pixel="meta"');
		expect(bodies[0]).toContain("1234567890");
	});
});

describe("SitesService.unpublish", () => {
	it("frees the slug, deletes current.html and the slug pointer", async () => {
		const { repository, routing, service } = setup({ kvConfigured: true });
		repository.unpublishActive.mockResolvedValue(
			deploymentRow({ slug: "smoke-project", status: "unpublished" }),
		);

		await service.unpublish(USER_ID, PROJECT_ID);

		expect(deleteObject).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/current.html`,
		);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			"smoke-project.wandit.app",
		);
	});

	it("is a no-op when nothing is live", async () => {
		const { routing, service } = setup({ kvConfigured: true });

		await service.unpublish(USER_ID, PROJECT_ID);

		expect(deleteObject).not.toHaveBeenCalled();
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});
});

describe("SitesService.rollback", () => {
	it("republished archived bytes without re-injecting pixels", async () => {
		const { repository, service } = setup();
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

		await service.rollback(USER_ID, PROJECT_ID, {
			deploymentId: target.id,
		});

		expect(vi.mocked(getPageHtml)).toHaveBeenCalledWith(
			`published/${PROJECT_ID}/v/${target.id}.html`,
		);
		// One marker only — the archive's pixel was not duplicated.
		expect(bodies[0]?.match(/data-wandit-pixel/g)).toHaveLength(1);
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
		repository.getOwnedProject.mockResolvedValue({
			id: PROJECT_ID,
			metaPixelId: "777",
			name: "Smoke Project",
			tiktokPixelId: null,
		});
		vi.mocked(getPageHtml)
			.mockResolvedValueOnce(null) // archive miss
			.mockResolvedValueOnce("<html><body>draft</body></html>");
		const bodies: string[] = [];
		vi.mocked(putPageHtml).mockImplementation(async (_key, html) => {
			bodies.push(html);
		});

		await service.rollback(USER_ID, PROJECT_ID, {
			deploymentId: target.id,
		});

		expect(bodies[0]).toContain('data-wandit-pixel="meta"');
	});

	it("404s on a deployment from another project", async () => {
		const { repository, service } = setup();
		repository.findById.mockResolvedValue(null);

		await expect(
			service.rollback(USER_ID, PROJECT_ID, {
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

			const { current } = await service.current(USER_ID, PROJECT_ID);

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
			service.slugAvailability(USER_ID, PROJECT_ID, "customers"),
		).resolves.toEqual({
			available: false,
			reason: "reserved",
			slug: "customers",
		});

		repository.isSlugTakenByOther.mockResolvedValue(true);
		await expect(
			service.slugAvailability(USER_ID, PROJECT_ID, "acme"),
		).resolves.toEqual({ available: false, reason: "taken", slug: "acme" });

		repository.isSlugTakenByOther.mockResolvedValue(false);
		await expect(
			service.slugAvailability(USER_ID, PROJECT_ID, "acme"),
		).resolves.toEqual({ available: true, reason: null, slug: "acme" });
	});
});
