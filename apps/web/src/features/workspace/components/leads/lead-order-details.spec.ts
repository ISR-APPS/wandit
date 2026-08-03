import type { LeadExtras } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LeadOrderDetails } from "./lead-order-details";

describe("LeadOrderDetails", () => {
	it("renders all public COD scalar values in an accessible disclosure", () => {
		const extras: LeadExtras = {
			bundle: "Family pack",
			variant: "Premium",
			quantity: 3,
			size: "XL",
			color: "Blue",
			delivery: "Home",
			_rawPhone: "0550000000",
		};

		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, { extras }),
		);

		expect(html).toContain("<details");
		expect(html).toContain("<summary");
		expect(html).toContain("Order details");
		for (const value of ["Family pack", "Premium", "3", "XL", "Blue", "Home"]) {
			expect(html).toContain(value);
		}
		expect(html).not.toContain("_rawPhone");
		expect(html).not.toContain("0550000000");
	});

	it("omits the disclosure when only internal extras exist", () => {
		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, {
				extras: { _rawPhone: "0550000000" },
			}),
		);

		expect(html).toBe("");
	});
});
