import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadsRepository } from "../../infrastructure/persistence/leads.repository";
import {
	LeadsCaptureRateLimitException,
	LeadsCaptureService,
} from "./leads-capture.service";
import type { LeadsCaptureThrottle } from "./leads-capture-throttle";

const FORM_ID = "0b0e8b1e-4a6f-4a5e-9a34-2f4dfd7f2c11";
const LOADED_DEPLOYMENT_ID = "f4593ee8-cb98-449a-b92a-3884252a8862";
const PROJECT_ID = "7f4f7e6a-1111-4222-8333-944445555666";

function buildService() {
	const repository = {
		findActiveDeploymentSnapshot: vi.fn().mockResolvedValue(null),
		findDeploymentSnapshotById: vi.fn().mockResolvedValue(null),
		findProjectByPublicFormId: vi.fn().mockResolvedValue({ id: PROJECT_ID }),
		upsertCaptureLead: vi.fn().mockResolvedValue(undefined),
	};
	const throttle = {
		consume: vi.fn().mockReturnValue({ allowed: true }),
	};
	const service = new LeadsCaptureService(
		repository as unknown as LeadsRepository,
		throttle as unknown as LeadsCaptureThrottle,
	);

	return { repository, service, throttle };
}

function validBody(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		name: "Amina B",
		phone: "0540 77 31 02",
		wilaya: "Alger",
		...overrides,
	});
}

describe("LeadsCaptureService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("inserts a normalized lead from a text/plain JSON body", async () => {
		const { repository, service, throttle } = buildService();

		const result = await service.capture(FORM_ID, validBody(), "1.2.3.4");

		expect(result).toEqual({ ok: true });
		expect(throttle.consume).toHaveBeenCalledWith(FORM_ID, "1.2.3.4");
		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				commune: null,
				deploymentId: null,
				extras: { _rawPhone: "0540 77 31 02" },
				name: "Amina B",
				phone: "+213540773102",
				productSku: null,
				projectId: PROJECT_ID,
				wilaya: "Alger",
			}),
			expect.any(Date),
		);
	});

	it("accepts an already-parsed JSON object body", async () => {
		const { repository, service } = buildService();

		await service.capture(
			FORM_ID,
			{ name: "Karim", phone: "0661234567" },
			"1.2.3.4",
		);

		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({ phone: "+213661234567" }),
			expect.any(Date),
		);
	});

	it("stamps the active version SKU and ignores visitor-provided SKU data", async () => {
		const { repository, service } = buildService();
		repository.findActiveDeploymentSnapshot.mockResolvedValue({
			deploymentId: "dep-1",
			productSku: "MERCHANT-SKU-01",
		});

		await service.capture(
			FORM_ID,
			validBody({ productSku: "VISITOR-CANNOT-OVERRIDE" }),
			"1.2.3.4",
		);

		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: "dep-1",
				productSku: "MERCHANT-SKU-01",
			}),
			expect.any(Date),
		);
	});

	it("stamps the deployment and SKU of the version loaded by the visitor", async () => {
		const { repository, service } = buildService();
		repository.findDeploymentSnapshotById.mockResolvedValue({
			deploymentId: LOADED_DEPLOYMENT_ID,
			productSku: "LOADED-SKU-01",
		});

		await service.capture(
			FORM_ID,
			validBody({ deploymentId: LOADED_DEPLOYMENT_ID }),
			"1.2.3.4",
		);

		expect(repository.findDeploymentSnapshotById).toHaveBeenCalledWith(
			PROJECT_ID,
			LOADED_DEPLOYMENT_ID,
		);
		expect(repository.findActiveDeploymentSnapshot).not.toHaveBeenCalled();
		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: LOADED_DEPLOYMENT_ID,
				productSku: "LOADED-SKU-01",
			}),
			expect.any(Date),
		);
	});

	it("keeps a null SKU from the loaded deployment without falling back", async () => {
		const { repository, service } = buildService();
		repository.findDeploymentSnapshotById.mockResolvedValue({
			deploymentId: LOADED_DEPLOYMENT_ID,
			productSku: null,
		});

		await service.capture(
			FORM_ID,
			validBody({ deploymentId: LOADED_DEPLOYMENT_ID }),
			"1.2.3.4",
		);

		expect(repository.findActiveDeploymentSnapshot).not.toHaveBeenCalled();
		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: LOADED_DEPLOYMENT_ID,
				productSku: null,
			}),
			expect.any(Date),
		);
	});

	it("falls back to the active deployment when the loaded id is unknown", async () => {
		const { repository, service } = buildService();
		repository.findActiveDeploymentSnapshot.mockResolvedValue({
			deploymentId: "dep-active",
			productSku: "ACTIVE-SKU-01",
		});

		await service.capture(
			FORM_ID,
			validBody({ deploymentId: LOADED_DEPLOYMENT_ID }),
			"1.2.3.4",
		);

		expect(repository.findDeploymentSnapshotById).toHaveBeenCalledWith(
			PROJECT_ID,
			LOADED_DEPLOYMENT_ID,
		);
		expect(repository.findActiveDeploymentSnapshot).toHaveBeenCalledWith(
			PROJECT_ID,
		);
		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: "dep-active",
				productSku: "ACTIVE-SKU-01",
			}),
			expect.any(Date),
		);
	});

	it("accepts a malformed loaded id and falls back to the active deployment", async () => {
		const { repository, service } = buildService();
		repository.findActiveDeploymentSnapshot.mockResolvedValue({
			deploymentId: "dep-active",
			productSku: "ACTIVE-SKU-01",
		});

		const result = await service.capture(
			FORM_ID,
			validBody({ deploymentId: "not-a-uuid" }),
			"1.2.3.4",
		);

		expect(result).toEqual({ ok: true });
		expect(repository.findDeploymentSnapshotById).not.toHaveBeenCalled();
		expect(repository.findActiveDeploymentSnapshot).toHaveBeenCalledWith(
			PROJECT_ID,
		);
		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: "dep-active",
				productSku: "ACTIVE-SKU-01",
			}),
			expect.any(Date),
		);
	});

	it.each([
		{ activeDeployment: null, expectedDeploymentId: null },
		{
			activeDeployment: { deploymentId: "dep-legacy", productSku: null },
			expectedDeploymentId: "dep-legacy",
		},
	])("inserts a null SKU when the active version or its SKU is missing", async ({
		activeDeployment,
		expectedDeploymentId,
	}) => {
		const { repository, service } = buildService();
		repository.findActiveDeploymentSnapshot.mockResolvedValue(activeDeployment);

		await service.capture(FORM_ID, validBody(), "1.2.3.4");

		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({
				deploymentId: expectedDeploymentId,
				productSku: null,
			}),
			expect.any(Date),
		);
	});

	it("answers ok without inserting when the honeypot is filled", async () => {
		const { repository, service, throttle } = buildService();

		const result = await service.capture(
			FORM_ID,
			validBody({ _hp: "http://spam.example" }),
			"1.2.3.4",
		);

		expect(result).toEqual({ ok: true });
		expect(throttle.consume).not.toHaveBeenCalled();
		expect(repository.upsertCaptureLead).not.toHaveBeenCalled();
	});

	it("upserts the full normalized payload with a two-minute cutoff", async () => {
		const { repository, service, throttle } = buildService();
		const before = Date.now();

		const result = await service.capture(FORM_ID, validBody(), "1.2.3.4");
		const after = Date.now();

		expect(result).toEqual({ ok: true });
		expect(throttle.consume).toHaveBeenCalledWith(FORM_ID, "1.2.3.4");
		expect(repository.upsertCaptureLead).toHaveBeenCalledTimes(1);
		const [payload, since] = repository.upsertCaptureLead.mock.calls[0] ?? [];
		expect(payload).toEqual({
			attribution: null,
			commune: null,
			deploymentId: null,
			extras: { _rawPhone: "0540 77 31 02" },
			name: "Amina B",
			phone: "+213540773102",
			productSku: null,
			projectId: PROJECT_ID,
			wilaya: "Alger",
		});
		expect(since).toBeInstanceOf(Date);
		expect(since?.getTime()).toBeGreaterThanOrEqual(before - 125_000);
		expect(since?.getTime()).toBeLessThanOrEqual(after - 115_000);
	});

	it("404s on an unknown form id", async () => {
		const { repository, service, throttle } = buildService();
		repository.findProjectByPublicFormId.mockResolvedValue(null);

		await expect(
			service.capture(FORM_ID, validBody(), "1.2.3.4"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(throttle.consume).not.toHaveBeenCalled();
	});

	it("429s with a retry delay only after resolution and validation", async () => {
		const { repository, service, throttle } = buildService();
		throttle.consume.mockReturnValue({
			allowed: false,
			retryAfterSeconds: 17,
		});

		const error = await service
			.capture(FORM_ID, validBody(), "1.2.3.4")
			.catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(LeadsCaptureRateLimitException);
		expect(error).toMatchObject({ retryAfterSeconds: 17 });
		if (!(error instanceof LeadsCaptureRateLimitException)) {
			throw new Error("Expected a lead capture rate-limit exception");
		}
		expect(error.getStatus()).toBe(429);
		expect(repository.findProjectByPublicFormId).toHaveBeenCalledWith(FORM_ID);
		expect(throttle.consume).toHaveBeenCalledWith(FORM_ID, "1.2.3.4");
		expect(repository.upsertCaptureLead).not.toHaveBeenCalled();
	});

	it("400s on malformed JSON and on an unusable phone", async () => {
		const { service, throttle } = buildService();

		await expect(
			service.capture(FORM_ID, "not json {", "1.2.3.4"),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(throttle.consume).not.toHaveBeenCalled();
		await expect(
			service.capture(FORM_ID, validBody({ phone: "hello" }), "1.2.3.4"),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(throttle.consume).not.toHaveBeenCalled();
	});

	it("strips unknown attribution keys via the contract whitelist", async () => {
		const { repository, service } = buildService();

		await service.capture(
			FORM_ID,
			validBody({
				attribution: { evil: "payload", fbclid: "click-1" },
			}),
			"1.2.3.4",
		);

		expect(repository.upsertCaptureLead).toHaveBeenCalledWith(
			expect.objectContaining({ attribution: { fbclid: "click-1" } }),
			expect.any(Date),
		);
	});
});
