import { describe, expect, it } from "vitest";

import { classifyProviderRejection } from "./provider-rejection";

describe("classifyProviderRejection", () => {
	it("humanizes the known Personal Clipper validation error", () => {
		expect(
			classifyProviderRejection(
				'Error starting generation: Validation error (422): {"error_type":"clipify_duration_unavailable"}',
			),
		).toEqual({
			kind: "validation",
			userMessage:
				"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.",
		});
	});

	it("humanizes unknown validation error types without exposing raw payloads", () => {
		expect(
			classifyProviderRejection(
				'Validation error (409): {"error_type":"unsupported_video_source","request_id":"req-secret"}',
			),
		).toEqual({
			kind: "validation",
			userMessage:
				"Higgsfield rejected the request (unsupported video source).",
		});
	});

	it("classifies an exhausted Higgsfield workspace", () => {
		expect(
			classifyProviderRejection(
				"Error starting generation: Out of credits (Request ID: req-secret)",
			),
		).toEqual({
			kind: "credits",
			userMessage: "Your Higgsfield workspace is out of credits.",
		});
	});

	it("classifies tools gated by the Higgsfield plan", () => {
		expect(
			classifyProviderRejection("Requires plus plan\nRequest ID: req-secret"),
		).toEqual({
			kind: "plan",
			userMessage: "This Higgsfield tool needs a higher Higgsfield plan.",
		});
	});

	it("passes an unknown provider rejection through with outer space trimmed", () => {
		expect(
			classifyProviderRejection("  The provider declined this render.  \n"),
		).toEqual({
			kind: "unknown",
			userMessage: "The provider declined this render.",
		});
	});

	it("strips provider request ids from unknown user messages", () => {
		expect(
			classifyProviderRejection(
				"The provider could not start this render.\nRequest ID: req-secret",
			),
		).toEqual({
			kind: "unknown",
			userMessage: "The provider could not start this render.",
		});
		expect(
			classifyProviderRejection(
				"The provider could not start this render (provider request-id=req-secret).",
			),
		).toEqual({
			kind: "unknown",
			userMessage: "The provider could not start this render.",
		});
	});

	it("does not treat a non-4xx error_type payload as validation", () => {
		const text =
			'Provider error (500): {"error_type":"clipify_duration_unavailable"}';

		expect(classifyProviderRejection(text)).toEqual({
			kind: "unknown",
			userMessage: text,
		});
	});
});
