import { describe, expect, it } from "vitest";

import { subscriptionRenewalReminderEmail } from "./auth-email-templates";

describe("subscriptionRenewalReminderEmail", () => {
	it("escapes the user name and the workspace name in the HTML", () => {
		const email = subscriptionRenewalReminderEmail(
			{
				interval: "month",
				kind: "renews",
				name: '<img src=x onerror="alert(1)">',
				organizationName: "<b>Acme</b>",
				periodEnd: new Date("2026-10-16T14:05:00.000Z"),
				plan: "pro",
			},
			"https://app.example.com/billing",
		);

		expect(email.html).not.toContain("<img");
		expect(email.html).not.toContain("<b>Acme</b>");
		expect(email.html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
	});
});
