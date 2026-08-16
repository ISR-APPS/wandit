import { describe, expect, it } from "vitest";

import { canDraftAutostart } from "./autostart-eligibility";

const requiresSource = (id: string) => id === "image-animation";

describe("canDraftAutostart", () => {
	it("allows a bare text draft", () => {
		expect(canDraftAutostart(undefined, 0, requiresSource)).toBe(true);
	});

	it("allows an auto-mode draft", () => {
		expect(
			canDraftAutostart(
				{ mode: "auto", quality: "standard" },
				0,
				requiresSource,
			),
		).toBe(true);
	});

	it("allows a page draft", () => {
		expect(
			canDraftAutostart(
				{ mode: "page", output: "landing-page", quality: "standard" },
				0,
				requiresSource,
			),
		).toBe(true);
	});

	it("refuses any draft that staged attachments", () => {
		expect(
			canDraftAutostart(
				{ mode: "page", output: "landing-page", quality: "standard" },
				1,
				requiresSource,
			),
		).toBe(false);
	});

	it("refuses every video draft, whatever the output", () => {
		expect(
			canDraftAutostart(
				{ mode: "video", output: "video-creator", quality: "standard" },
				0,
				requiresSource,
			),
		).toBe(false);
	});

	it("refuses an output that requires a source image", () => {
		expect(
			canDraftAutostart(
				{ mode: "image", output: "image-animation", quality: "standard" },
				0,
				requiresSource,
			),
		).toBe(false);
	});

	it("consults the registry predicate for source-first outputs", () => {
		expect(
			canDraftAutostart(
				{ mode: "image", output: "future-output", quality: "standard" },
				0,
				() => true,
			),
		).toBe(false);
	});
});
