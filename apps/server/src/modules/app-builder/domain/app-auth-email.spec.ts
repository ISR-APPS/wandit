import { describe, expect, it } from "vitest";

import {
	appEmailSenderName,
	confirmationEmailHtml,
	supportsEmailCode,
} from "./app-auth-email";

describe("appEmailSenderName", () => {
	it.each([
		{
			case: "control characters, which can add a mail header",
			projectName: "Nour\r\nBcc: x@y.z\u0000 Shop",
			expected: "Nour Bcc: x@y.z Shop",
		},
		{
			case: "braces, which can start a Go template action",
			projectName: "{{ .SiteURL }} Shop",
			expected: ".SiteURL Shop",
		},
		{
			case: "angle brackets and quotes",
			projectName: '<b>"Nour"</b> Objets',
			expected: "b Nour /b Objets",
		},
		{
			case: "a bidirectional override, which can reorder the shown name",
			projectName: "Shop\u202egnp",
			expected: "Shop gnp",
		},
		{
			case: "a MIME encoded word, which a mail client can decode to PayPal",
			projectName: "=?utf-8?B?UGF5UGFs?=",
			expected: "utf-8?B?UGF5UGFs?=",
		},
		{
			case: "a name of more than 60 characters",
			projectName: "x".repeat(80),
			expected: "x".repeat(60),
		},
		{
			case: "a name that is empty after the clean",
			projectName: " \n{}<> ",
			expected: "Your app",
		},
		{
			// A zero-width space, a soft hyphen, a Hangul filler, and a blank braille cell.
			case: "a name that shows no glyph",
			projectName: "\u200b\u00ad\u3164\u2800",
			expected: "Your app",
		},
		{
			case: "a phishing term in mixed case",
			projectName: "PayPal Support",
			expected: "Your app",
		},
		{
			case: "the platform name",
			projectName: "Wandit Support",
			expected: "Your app",
		},
		{
			// A Cyrillic "a" and the digit 1.
			case: "the platform name in look-alike letters",
			projectName: "W\u0430nd1t: account locked",
			expected: "Your app",
		},
		{
			// Without the dot rule, the check drops " Login" as a top-level domain.
			case: "a phishing term after a dot",
			projectName: "Shop. Login",
			expected: "Your app",
		},
		{
			case: "an honest name with a dot",
			projectName: "Dr. Amine Dental",
			expected: "Dr. Amine Dental",
		},
		{
			case: "an Arabic name",
			projectName: "متجر نور",
			expected: "متجر نور",
		},
	])("answers the safe name for $case", ({ projectName, expected }) => {
		expect(appEmailSenderName(projectName)).toBe(expected);
	});
});

describe("confirmationEmailHtml", () => {
	it("escapes the name and holds no other Go template action", () => {
		const html = confirmationEmailHtml("Tom & {{ .SiteURL }} <script>");

		expect(html).toContain("Tom &amp; &#123;&#123; .SiteURL &#125;&#125;");
		expect(html).not.toContain("<script>");
		expect(html.match(/\{\{[^}]*\}\}/g)).toEqual([
			"{{ .Email }}",
			"{{ .Token }}",
		]);
	});
});

describe("supportsEmailCode", () => {
	it.each([
		["web-app@1.1.0", false],
		["web-app@1.2.0", true],
		// Numbers, not text: minor 10 is later than minor 2.
		["web-app@1.10.0", true],
		["web-app@2.0.0", true],
		["mobile-app@1.2.0", false],
		["mobile-app@1.3.0", true],
		["desktop-app@1.1.0", false],
		["web-app@1.2", false],
		[null, false],
	])("gates the code step of %s: %s", (templateVersion, expected) => {
		expect(supportsEmailCode(templateVersion)).toBe(expected);
	});
});
