import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadsRepository } from "../../infrastructure/persistence/leads.repository";
import {
	LeadsCaptureRateLimitException,
	LeadsCaptureService,
} from "./leads-capture.service";
import type { LeadsCaptureThrottle } from "./leads-capture-throttle";

const FORM_ID = "0b0e8b1e-4a6f-4a5e-9a34-2f4dfd7f2c11";
const PROJECT_ID = "7f4f7e6a-1111-4222-8333-944445555666";

function buildService() {
	const repository = {
		findActiveDeploymentId: vi.fn().mockResolvedValue(null),
		findProjectByPublicFormId: vi.fn().mockResolvedValue({ id: PROJECT_ID }),
		hasRecentLeadWithPhone: vi.fn().mockResolvedValue(false),
		insertLead: vi.fn().mockResolvedValue(undefined),
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
		expect(repository.insertLead).toHaveBeenCalledWith(
			expect.objectContaining({
				commune: null,
				deploymentId: null,
				extras: { _rawPhone: "0540 77 31 02" },
				name: "Amina B",
				phone: "+213540773102",
				projectId: PROJECT_ID,
				wilaya: "Alger",
			}),
		);
	});

	it("accepts an already-parsed JSON object body", async () => {
		const { repository, service } = buildService();

		await service.capture(
			FORM_ID,
			{ name: "Karim", phone: "0661234567" },
			"1.2.3.4",
		);

		expect(repository.insertLead).toHaveBeenCalledWith(
			expect.objectContaining({ phone: "+213661234567" }),
		);
	});

	it("stamps the active deployment when one exists", async () => {
		const { repository, service } = buildService();
		repository.findActiveDeploymentId.mockResolvedValue("dep-1");

		await service.capture(FORM_ID, validBody(), "1.2.3.4");

		expect(repository.insertLead).toHaveBeenCalledWith(
			expect.objectContaining({ deploymentId: "dep-1" }),
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
		expect(repository.insertLead).not.toHaveBeenCalled();
	});

	it("answers ok without inserting on a recent duplicate phone", async () => {
		const { repository, service, throttle } = buildService();
		repository.hasRecentLeadWithPhone.mockResolvedValue(true);

		const result = await service.capture(FORM_ID, validBody(), "1.2.3.4");

		expect(result).toEqual({ ok: true });
		expect(throttle.consume).toHaveBeenCalledWith(FORM_ID, "1.2.3.4");
		expect(repository.insertLead).not.toHaveBeenCalled();
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
		expect(repository.hasRecentLeadWithPhone).not.toHaveBeenCalled();
		expect(repository.insertLead).not.toHaveBeenCalled();
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

		expect(repository.insertLead).toHaveBeenCalledWith(
			expect.objectContaining({ attribution: { fbclid: "click-1" } }),
		);
	});
});
