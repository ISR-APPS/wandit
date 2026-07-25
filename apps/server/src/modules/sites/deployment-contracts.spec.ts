import {
	deploymentCurrentSchema,
	deploymentSchema,
	deploymentSlugSchema,
	isReservedSlug,
	publishDeploymentBodySchema,
	RESERVED_SLUGS,
	slugAvailabilityResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

// The slug shape lives in three places: this contract, the Postgres CHECK
// (deployments_slug_dns_label_ck), and the web's isValidSlug. This spec pins
// the contract copy; the DB and web copies must match it byte for byte.
describe("deployment slug contract", () => {
	it.each(["acme", "a", "my-shop-2", "x".repeat(63)])("accepts %s", (slug) => {
		expect(deploymentSlugSchema.safeParse(slug).success).toBe(true);
	});

	it.each([
		"-acme",
		"acme-",
		"Ac me",
		"a_b",
		"",
		"x".repeat(64),
		"a..b",
	])("rejects %s", (slug) => {
		expect(deploymentSlugSchema.safeParse(slug).success).toBe(false);
	});
});

describe("reserved slugs", () => {
	it("always reserves the SaaS fallback origin label", () => {
		// customers.wandit.app is the live DOMAINS_FALLBACK_ORIGIN — a customer
		// site on that label would shadow Cloudflare-for-SaaS traffic.
		expect(RESERVED_SLUGS).toContain("customers");
		expect(isReservedSlug("customers")).toBe(true);
	});

	it("reserves core app surfaces", () => {
		for (const slug of ["www", "api", "app", "admin", "preview"]) {
			expect(isReservedSlug(slug)).toBe(true);
		}
	});

	it("does not reserve ordinary names", () => {
		expect(isReservedSlug("smoke-project")).toBe(false);
	});
});

describe("deployment schemas round-trip", () => {
	it("parses a deployment", () => {
		const deployment = {
			createdAt: "2026-07-25T10:00:00.000Z",
			error: null,
			id: "33333333-3333-4333-8333-333333333333",
			projectId: "11111111-1111-4111-8111-111111111111",
			slug: "acme",
			status: "active",
			updatedAt: "2026-07-25T10:00:00.000Z",
			versionId: "22222222-2222-4222-8222-222222222222",
		};

		expect(deploymentSchema.parse(deployment)).toEqual(deployment);
	});

	it("parses the current shape for every uiState", () => {
		for (const uiState of ["draft", "publishing", "published", "failed"]) {
			const current = {
				activeDeploymentId: null,
				error: uiState === "failed" ? "boom" : null,
				liveUrl: uiState === "published" ? "https://acme.wandit.app" : null,
				pendingVersionId: null,
				publishedAt: null,
				publishedVersionId: null,
				slug: null,
				uiState,
			};

			expect(deploymentCurrentSchema.parse(current)).toEqual(current);
		}
	});

	it("publish body accepts empty, slug-only, and version-only", () => {
		expect(publishDeploymentBodySchema.parse({})).toEqual({});
		expect(
			publishDeploymentBodySchema.safeParse({ slug: "acme" }).success,
		).toBe(true);
		expect(
			publishDeploymentBodySchema.safeParse({ slug: "-bad-" }).success,
		).toBe(false);
	});

	it("slug availability reasons are typed", () => {
		expect(
			slugAvailabilityResponseSchema.safeParse({
				available: false,
				reason: "reserved",
				slug: "customers",
			}).success,
		).toBe(true);
		expect(
			slugAvailabilityResponseSchema.safeParse({
				available: false,
				reason: "nope",
				slug: "x",
			}).success,
		).toBe(false);
	});
});
