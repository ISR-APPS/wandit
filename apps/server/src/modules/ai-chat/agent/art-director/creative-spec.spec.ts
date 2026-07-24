import { describe, expect, it } from "vitest";

import {
	assertCreativeSpecSemantics,
	creativeSpecSchema,
	serializeCreativeSpec,
} from "./creative-spec";
import { createCreativeSpecFixture } from "./creative-spec.fixture";

describe("CreativeSpec", () => {
	it("accepts and serializes a complete Art Director handoff", () => {
		const spec = creativeSpecSchema.parse(createCreativeSpecFixture());

		expect(() => assertCreativeSpecSemantics(spec)).not.toThrow();
		expect(JSON.parse(serializeCreativeSpec(spec))).toEqual(spec);
	});

	it("keeps a complete spec when a model overshoots an advisory list maximum", () => {
		const spec = createCreativeSpecFixture();
		spec.builderContract.failureModes = Array.from(
			{ length: 11 },
			(_, index) => `Failure mode ${index + 1}`,
		);

		const parsed = creativeSpecSchema.parse(spec);

		expect(parsed.builderContract.failureModes).toHaveLength(8);
		expect(parsed.builderContract.failureModes[0]).toBe("Failure mode 1");
	});

	it("still rejects advisory lists below their minimum", () => {
		const spec = createCreativeSpecFixture();
		spec.builderContract.failureModes = ["Only one failure mode"];

		expect(() => creativeSpecSchema.parse(spec)).toThrow();
	});

	it("recovers when a model omits the redundant opening format summary", () => {
		const spec = createCreativeSpecFixture();
		delete (spec.opening as { format?: string }).format;

		const parsed = creativeSpecSchema.parse(spec);

		expect(parsed.opening.format).toContain(
			"opening architecture already defined",
		);
	});

	it("rejects non-CSS palette descriptions", () => {
		const spec = createCreativeSpecFixture();
		spec.visualSystem.palette.accent = "warm coral";

		expect(() => creativeSpecSchema.parse(spec)).toThrow();
	});

	it("requires a real loading strategy for every font role", () => {
		const spec = createCreativeSpecFixture();
		spec.visualSystem.typography.heading.stylesheetUrl = null;

		expect(() => creativeSpecSchema.parse(spec)).toThrow(
			/require an exact stylesheetUrl/,
		);
	});

	it("rejects duplicate section semanticIds", () => {
		const spec = createCreativeSpecFixture();
		const secondSection = spec.page.sections[1];

		if (!secondSection) {
			throw new Error("fixture must include a second section");
		}

		secondSection.semanticId =
			spec.page.sections[0]?.semanticId ?? "treatments";

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/duplicate section semanticIds/,
		);
	});

	it("rejects a section semanticId that conflicts with the opening", () => {
		const spec = createCreativeSpecFixture();
		const firstSection = spec.page.sections[0];

		if (!firstSection) {
			throw new Error("fixture must include a section");
		}

		firstSection.semanticId = "hero";

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/conflicts with the opening/,
		);
	});

	it("rejects section semanticIds that conflict with the closing scene", () => {
		const spec = createCreativeSpecFixture();
		const firstSection = spec.page.sections[0];

		if (!firstSection) {
			throw new Error("fixture must include a section");
		}

		firstSection.semanticId = "site-footer";

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/conflicts with the closing scene/,
		);
	});

	it("rejects section semanticIds reserved for editable elements", () => {
		const spec = createCreativeSpecFixture();
		const firstSection = spec.page.sections[0];

		if (!firstSection) {
			throw new Error("fixture must include a section");
		}

		firstSection.semanticId = "e-1";

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/reserved for editable elements/,
		);
	});

	it("rejects a showpiece that does not resolve to the opening or a section", () => {
		const spec = createCreativeSpecFixture();
		spec.page.showpiece.semanticId = "missing-scene";

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/does not match the opening or a section semanticId/,
		);
	});

	it("allows the opening to be the showpiece", () => {
		const spec = createCreativeSpecFixture();
		spec.page.showpiece.semanticId = "hero";

		expect(() => assertCreativeSpecSemantics(spec)).not.toThrow();
	});

	it("rejects duplicate generated shot ids", () => {
		const spec = createCreativeSpecFixture();
		const shot = {
			aspect: "16:9" as const,
			id: "opening-evidence",
			placement: "A measured crop inside the opening.",
			prompt:
				"Editorial photograph of a calm clinic, soft daylight, exact neutral palette, no text, logos, watermarks, or UI.",
			role: "Documentary evidence",
		};
		spec.media.generatedShots = [shot, { ...shot }];

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/duplicate generated shot ids/,
		);
	});

	it("rejects an ambient video source that has no planned generated shot", () => {
		const spec = createCreativeSpecFixture();
		spec.media.ambientVideo = {
			aspect: "16:9",
			motionPrompt: "A restrained two-percent light drift across the surface.",
			placement: "Behind the opening diagram.",
			source: {
				kind: "generated-shot",
				reference: "missing-shot",
			},
		};

		expect(() => assertCreativeSpecSemantics(spec)).toThrow(
			/does not match a generated shot id/,
		);
	});
});
