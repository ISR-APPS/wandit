import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TargetChip } from "./target-chip";

describe("TargetChip", () => {
	it("renders tag and auto-direction excerpt without exposing the wid as copy", () => {
		const html = renderToStaticMarkup(
			createElement(TargetChip, {
				target: {
					wid: "e-42",
					tag: "h2",
					excerpt: "عنوان عربي",
				},
			}),
		);

		expect(html).toContain('title="e-42"');
		expect(html).toContain('<bdi dir="ltr"');
		expect(html).toContain('<span dir="auto"');
		expect(html.match(/dir="ltr"/g)).toHaveLength(1);
		expect(html.replace(/<[^>]+>/g, "")).not.toContain("e-42");
		expect(html.replace(/<[^>]+>/g, "")).toContain("h2·عنوان عربي");
	});

	it("renders the localized clear affordance only for a pending target", () => {
		const html = renderToStaticMarkup(
			createElement(TargetChip, {
				target: { wid: "hero", tag: "section", excerpt: null },
				onClear: () => {},
				clearLabel: "Clear target",
			}),
		);

		expect(html).toContain('aria-label="Clear target"');
		expect(html).toContain(">section</bdi>");
	});
});
