import { describe, expect, it } from "vitest";

import { parseInviteEmails } from "./invite-emails";

describe("parseInviteEmails", () => {
	it.each([
		{
			label: "a pasted list with mixed separators",
			text: "a@x.com, b@x.com;c@x.com\nd@x.com\t e@x.com",
			emails: ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"],
			invalid: [],
		},
		{
			label: "one address twice in different case",
			text: "Ana@X.com ana@x.com",
			emails: ["ana@x.com"],
			invalid: [],
		},
		{
			label: "a name and a broken address beside a good one",
			text: "Ana, ana@x.com, bob@",
			emails: ["ana@x.com"],
			invalid: ["Ana", "bob@"],
		},
		{
			label: "only separators",
			text: " ,; \n",
			emails: [],
			invalid: [],
		},
	])("parses $label", ({ text, emails, invalid }) => {
		expect(parseInviteEmails(text)).toEqual({ emails, invalid });
	});
});
