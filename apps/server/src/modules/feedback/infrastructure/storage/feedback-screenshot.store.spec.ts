import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

const r2 = vi.hoisted(() => ({
	isConfigured: vi.fn(() => true),
	putSiteFile: vi.fn(),
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	feedbackScreenshotKey: (feedbackId: string, extension: string) =>
		`feedback/${feedbackId}/screenshot.${extension}`,
	isR2Configured: r2.isConfigured,
	publicAssetUrl: (key: string) => `https://assets.example.com/${key}`,
	putSiteFile: r2.putSiteFile,
}));

import { FeedbackScreenshotStore } from "./feedback-screenshot.store";

beforeEach(() => {
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	r2.isConfigured.mockReturnValue(true);
	r2.putSiteFile.mockReset().mockResolvedValue(undefined);
	vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
});

describe("FeedbackScreenshotStore", () => {
	it("stores a decoded screenshot without immutable cache control", async () => {
		const store = new FeedbackScreenshotStore();

		await expect(
			store.store("feedback-id", "data:image/png;base64,aGVsbG8="),
		).resolves.toBe(
			"https://assets.example.com/feedback/feedback-id/screenshot.png",
		);
		expect(r2.putSiteFile).toHaveBeenCalledWith(
			"feedback/feedback-id/screenshot.png",
			Buffer.from("hello"),
			"image/png",
		);
	});

	it("returns null when R2 or its public URL is not configured", async () => {
		const store = new FeedbackScreenshotStore();

		r2.isConfigured.mockReturnValue(false);
		await expect(
			store.store("feedback-id", "data:image/png;base64,aGVsbG8="),
		).resolves.toBeNull();

		r2.isConfigured.mockReturnValue(true);
		mockEnv.R2_PUBLIC_BASE_URL = "";
		await expect(
			store.store("feedback-id", "data:image/png;base64,aGVsbG8="),
		).resolves.toBeNull();

		expect(r2.putSiteFile).not.toHaveBeenCalled();
	});

	it("returns null when the data URL cannot be decoded", async () => {
		const store = new FeedbackScreenshotStore();

		await expect(
			store.store("feedback-id", "not a screenshot"),
		).resolves.toBeNull();
		expect(r2.putSiteFile).not.toHaveBeenCalled();
	});

	it("returns null instead of throwing when the upload fails", async () => {
		const store = new FeedbackScreenshotStore();
		r2.putSiteFile.mockRejectedValueOnce(new Error("R2 unavailable"));

		await expect(
			store.store("feedback-id", "data:image/jpeg;base64,aGVsbG8="),
		).resolves.toBeNull();
	});
});
