// Pins the deployments wire contract the web codes against: shapes round-trip
// through the zod schemas and the reserved-slug list protects app hostnames.

import {
	deploymentCurrentResponseSchema,
	deploymentSlugSchema,
	isReservedSlug,
	listDeploymentsResponseSchema,
	publishDeploymentResponseSchema,
	RESERVED_SLUGS,
	slugAvailabilityResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const deployment = {
	id: "11111111-1111-4111-8111-111111111111",
	projectId: "22222222-2222-4222-8222-222222222222",
	versionId: "33333333-3333-4333-8333-333333333333",
	slug: "acme",
	status: "active",
	error: null,
	createdAt: "2026-07-25T12:00:00.000Z",
	updatedAt: "2026-07-25T12:00:05.000Z",
} as const;

const currentPublished = {
	uiState: "published",
	slug: "acme",
	activeDeploymentId: deployment.id,
	publishedVersionId: deployment.versionId,
	pendingVersionId: deployment.versionId,
	publishedAt: "2026-07-25T12:00:05.000Z",
	liveUrl: "https://acme.wandit.app",
	error: null,
} as const;

describe("deployments contracts", () => {
	it("round-trips the current snapshot and publish response", () => {
		expect(
			deploymentCurrentResponseSchema.parse({ current: currentPublished })
				.current,
		).toEqual(currentPublished);
		expect(
			publishDeploymentResponseSchema.parse({
				deployment,
				current: currentPublished,
			}).deployment,
		).toEqual(deployment);
		expect(
			listDeploymentsResponseSchema.parse({ deployments: [deployment] })
				.deployments,
		).toHaveLength(1);
	});

	it("round-trips a never-published draft snapshot", () => {
		const draft = {
			uiState: "draft",
			slug: null,
			activeDeploymentId: null,
			publishedVersionId: null,
			pendingVersionId: null,
			publishedAt: null,
			liveUrl: null,
			error: null,
		};
		expect(
			deploymentCurrentResponseSchema.parse({ current: draft }).current,
		).toEqual(draft);
	});

	it("parses slug availability verdicts including the reserved reason", () => {
		expect(
			slugAvailabilityResponseSchema.parse({
				slug: "acme",
				available: false,
				reason: "reserved",
			}).reason,
		).toBe("reserved");
	});

	it("keeps app hostnames reserved and matches the DNS-label shape", () => {
		for (const slug of ["customers", "www", "api", "app", "admin"]) {
			expect(RESERVED_SLUGS).toContain(slug);
			expect(isReservedSlug(slug)).toBe(true);
		}
		expect(isReservedSlug("acme")).toBe(false);

		// Every reserved entry must itself be a valid slug, or the list could
		// never collide with real input.
		for (const slug of RESERVED_SLUGS) {
			expect(deploymentSlugSchema.safeParse(slug).success).toBe(true);
		}
	});

	it("rejects slugs the DB check constraint would reject", () => {
		for (const bad of ["-acme", "acme-", "Acme", "a".repeat(64), ""]) {
			expect(deploymentSlugSchema.safeParse(bad).success).toBe(false);
		}
	});
});
