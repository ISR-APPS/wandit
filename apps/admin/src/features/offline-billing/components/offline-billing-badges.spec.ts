import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManualRequestStatusBadge } from "./offline-billing-badges";

describe("ManualRequestStatusBadge", () => {
	it("shows No answer with the amber warning tone", () => {
		const html = renderToStaticMarkup(
			createElement(ManualRequestStatusBadge, { status: "no_answer" }),
		);

		expect(html).toContain("No answer");
		expect(html).toContain("bg-amber-500/10");
	});

	it("shows Canceled with the destructive tone", () => {
		const html = renderToStaticMarkup(
			createElement(ManualRequestStatusBadge, { status: "canceled" }),
		);

		expect(html).toContain("Canceled");
		expect(html).toContain('data-variant="destructive"');
	});
});
