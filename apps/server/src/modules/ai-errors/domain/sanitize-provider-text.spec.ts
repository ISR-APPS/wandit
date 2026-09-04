import { describe, expect, it } from "vitest";

import {
	HIGGSFIELD_CREDITS_MESSAGE,
	HIGGSFIELD_NSFW_MESSAGE,
	looksLikeCredential,
	redactProviderText,
	sanitizeModerationCategories,
	sanitizeProviderText,
	stripRequestIds,
} from "./sanitize-provider-text";

describe("sanitizeProviderText", () => {
	it("selects only allowlisted JSON fields in priority order", () => {
		expect(
			sanitizeProviderText(
				JSON.stringify({
					error: { message: "sexual" },
					message: "lower priority",
					prompt: "must never be forwarded",
				}),
				{ kind: "content_moderated", provider: "openai" },
			),
		).toBe("sexual content");

		expect(
			sanitizeProviderText(
				JSON.stringify({
					content: [{ text: "violence", type: "text" }],
				}),
				{ kind: "content_moderated", provider: "openai" },
			),
		).toBe("violence");
	});

	it("returns null for JSON without an allowlisted text key", () => {
		expect(
			sanitizeProviderText(
				JSON.stringify({
					prompt: "private prompt",
					request_id: "req-secret",
					state: "failed",
				}),
				{
					kind: "connector_rejected",
					provider: "higgsfield",
					connectorSlug: "higgsfield",
				},
			),
		).toBeNull();
	});

	it("does not forward the Higgsfield status fixture with ids, OAuth data, and an image URL", () => {
		const fixture = JSON.stringify({
			image_url: "https://files.higgsfield.ai/private/render.png",
			prompt: "private customer prompt",
			request_id: "req-secret",
			state: "failed",
			token: "ya29.private-google-oauth-token",
		});

		expect(
			sanitizeProviderText(fixture, {
				kind: "connector_rejected",
				provider: "higgsfield",
				connectorSlug: "higgsfield",
			}),
		).toBeNull();
	});

	it("drops stack lines and node_modules paths from redacted diagnostic text", () => {
		expect(
			redactProviderText(
				"Provider failed\n    at execute (/srv/app.ts:10:2)\nwrapped in /srv/node_modules/pkg/index.js\nKeep this line",
			),
		).toBe("Provider failed\nKeep this line");
	});

	it("redacts credentials embedded in JSON diagnostics", () => {
		const redacted = redactProviderText(
			'{"token":"ya29.private-token","access_token":"secret","message":"keep"}',
		);

		expect(redacted).toContain('"message":"keep"');
		expect(redacted).not.toMatch(/ya29|private-token|access_token|secret/iu);
	});

	it("enforces the content-moderation provider allowlist", () => {
		expect(
			sanitizeProviderText("sexual, violence, private prompt words", {
				kind: "content_moderated",
				provider: "openai",
			}),
		).toBe("sexual content, violence");
		expect(
			sanitizeProviderText("sexual", {
				kind: "content_moderated",
				provider: "anthropic",
			}),
		).toBe("sexual content");
		expect(
			sanitizeProviderText("the echoed flagged_input prompt", {
				kind: "content_moderated",
				provider: "anthropic",
			}),
		).toBeNull();
		expect(
			sanitizeProviderText("Safety block Support codes: 15236754", {
				kind: "content_moderated",
				provider: "google",
			}),
		).toBeNull();
		expect(
			sanitizeProviderText("nsfw", {
				kind: "content_moderated",
				provider: "higgsfield",
			}),
		).toBe(HIGGSFIELD_NSFW_MESSAGE);
	});

	it("forwards only allowlisted Higgsfield connector sentences", () => {
		const validation =
			"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.";

		expect(
			sanitizeProviderText(validation, {
				kind: "connector_rejected",
				provider: "higgsfield",
				connectorSlug: "higgsfield",
			}),
		).toBe(validation);
		expect(
			sanitizeProviderText("The provider declined this render", {
				kind: "connector_rejected",
				provider: "higgsfield",
				connectorSlug: "higgsfield",
			}),
		).toBeNull();
		expect(
			sanitizeProviderText(HIGGSFIELD_CREDITS_MESSAGE, {
				kind: "connector_account",
				provider: "higgsfield",
				connectorSlug: "higgsfield",
			}),
		).toBe(HIGGSFIELD_CREDITS_MESSAGE);
	});

	it("caps forwarded text at the requested size including the ellipsis", () => {
		const sanitized = sanitizeProviderText(HIGGSFIELD_CREDITS_MESSAGE, {
			connectorSlug: "higgsfield",
			kind: "connector_account",
			provider: "higgsfield",
			maxLength: 20,
		});

		expect(sanitized).toHaveLength(20);
		expect(sanitized?.endsWith("…")).toBe(true);
	});

	it("does not forward text for non-forward policy kinds", () => {
		expect(
			sanitizeProviderText("Provider detail", {
				kind: "provider_error",
				provider: "openai",
			}),
		).toBeNull();
	});
});

describe("provider text redaction helpers", () => {
	it("recognizes legacy and newly supported credential shapes", () => {
		for (const value of [
			"sk-live_123",
			"ya29.private-token",
			"EAAFacebookToken123456",
			"Bearer opaque-token",
			"access_token=opaque-token",
			"refresh_token=opaque-token",
			"aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccc",
		]) {
			expect(looksLikeCredential(value), value).toBe(true);
		}

		expect(looksLikeCredential("PROVIDER_REJECTED")).toBe(false);
	});

	it("strips request ids without removing the surrounding message", () => {
		expect(
			stripRequestIds(
				"The provider could not start this render (provider request-id=req-secret).",
			),
		).toBe("The provider could not start this render.");
	});

	it("filters moderation reasons through known category labels", () => {
		expect(
			sanitizeModerationCategories([
				"sexual",
				"violence/graphic",
				"private prompt fragment",
			]),
		).toBe("sexual content, graphic violence");
	});
});
