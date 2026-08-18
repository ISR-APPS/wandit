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
		// bundle/quantity/delivery are recognized order facts — they show in the
		// always-visible summary line, not only inside the disclosure.
		expect(html).toContain("Family pack × 3 · Home");
		expect(html).not.toContain("_rawPhone");
		expect(html).not.toContain("0550000000");
	});

	it("shows an always-visible order summary with product, quantity and total", () => {
		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, {
				extras: { product: "Pack Duo", quantity: 2, total: "3500 DA" },
			}),
		);

		expect(html).toContain("Pack Duo × 2 · Total: 3500 DA");
	});

	it("skips the summary line when no order fact is recognized", () => {
		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, { extras: { size: "XL" } }),
		);

		expect(html.startsWith("<details")).toBe(true);
		expect(html).not.toContain("Total:");
	});

	it("treats empty-string order values as absent — no stray separators", () => {
		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, {
				extras: { delivery: "", product: "Pack" },
			}),
		);

		expect(html).toContain("Pack");
		expect(html).not.toContain("Pack · ");
	});

	it("renders the localized total label when one is passed", () => {
		const html = renderToStaticMarkup(
			createElement(LeadOrderDetails, {
				extras: { total: "3500 DA" },
				totalLabel: "المجموع",
			}),
		);

		expect(html).toContain("المجموع: 3500 DA");
		expect(html).not.toContain("Total:");
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
