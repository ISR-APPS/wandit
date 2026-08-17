import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useDictionary: () => ({
		legal: {
			common: {
				googlePolicyLabel: "Google API Services User Data Policy",
				googlePermissionsLabel: "Google Account permissions page",
			},
		},
	}),
}));

import { splitTemplate } from "../lib/template";
import { LegalText } from "./legal-text";

describe("splitTemplate", () => {
	it("keeps literal runs and tokens in order", () => {
		expect(splitTemplate("Write to {email} today")).toEqual([
			{ kind: "text", value: "Write to " },
			{ kind: "token", name: "email" },
			{ kind: "text", value: " today" },
		]);
	});

	it("drops the empty run when a token opens the string", () => {
		expect(splitTemplate("{company}, {siteUrl}.")).toEqual([
			{ kind: "token", name: "company" },
			{ kind: "text", value: ", " },
			{ kind: "token", name: "siteUrl" },
			{ kind: "text", value: "." },
		]);
	});
});

describe("LegalText", () => {
	it("renders the contact address as a mailto link", () => {
		const html = renderToStaticMarkup(
			createElement(LegalText, { value: "Write to {email}." }),
		);

		expect(html).toContain('href="mailto:contact@scalemindapps.com"');
		expect(html).toContain("contact@scalemindapps.com");
	});

	it("links the Limited Use sentence to the Google user data policy", () => {
		const html = renderToStaticMarkup(
			createElement(LegalText, {
				value:
					"Wandit's use and transfer to any other app of information received from Google APIs will adhere to {googlePolicyUrl}, including the Limited Use requirements.",
			}),
		);

		expect(html).toContain(
			'href="https://developers.google.com/terms/api-services-user-data-policy"',
		);
		expect(html).toContain("Google API Services User Data Policy");
		// Google matches this sentence against the consent screen, so the app
		// name is literal copy and no {company} token may replace it.
		expect(html).toContain("Wandit&#x27;s use and transfer to any other app");
	});

	it("renders the entity, its office and its register numbers as plain text", () => {
		const html = renderToStaticMarkup(
			createElement(LegalText, {
				value:
					"{company}, {address}. Trade licence no. {licenceNo}, register no. {registerNo}.",
			}),
		);

		expect(html).toContain("Scalemind Marketing Consultancy L.L.C");
		expect(html).toContain(
			"Office 94-104, Khalid Abdulrahim Shaaban Building, Al Garhoud, Deira, Dubai, United Arab Emirates",
		);
		expect(html).toContain("1570192");
		expect(html).toContain("2743008");
	});

	it("renders the Drive scope verbatim and the permissions page as a link", () => {
		const html = renderToStaticMarkup(
			createElement(LegalText, {
				value:
					"We ask for {driveScope} and you can revoke it on your {googlePermissionsUrl}.",
			}),
		);

		expect(html).toContain("https://www.googleapis.com/auth/drive.file");
		expect(html).toContain('href="https://myaccount.google.com/permissions"');
		expect(html).toContain("Google Account permissions page");
	});

	it("shows an unmapped token raw rather than dropping the sentence", () => {
		const html = renderToStaticMarkup(
			createElement(LegalText, { value: "A {unknownToken} stays visible." }),
		);

		expect(html).toContain("{unknownToken}");
	});
});
