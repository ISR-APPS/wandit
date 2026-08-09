import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
	LeadsCaptureRateLimitException,
	type LeadsCaptureService,
} from "../../../application/services/leads-capture.service";
import { LeadsCaptureController } from "./leads-capture.controller";

const FORM_ID = "0b0e8b1e-4a6f-4a5e-9a34-2f4dfd7f2c11";

describe("LeadsCaptureController", () => {
	it("sets Retry-After when a valid capture is rate limited", async () => {
		const error = new LeadsCaptureRateLimitException(17);
		const capture = vi.fn().mockRejectedValue(error);
		const controller = new LeadsCaptureController({
			capture,
		} as unknown as LeadsCaptureService);
		const reply = {
			header: vi.fn(),
		} as unknown as FastifyReply;
		const request = {
			headers: {},
			ip: "1.2.3.4",
		} as unknown as FastifyRequest;

		await expect(
			controller.capture(FORM_ID, { name: "Amina" }, request, reply),
		).rejects.toBe(error);

		expect(reply.header).toHaveBeenCalledWith("Retry-After", "17");
		expect(capture).toHaveBeenCalledWith(FORM_ID, { name: "Amina" }, "1.2.3.4");
	});
});
