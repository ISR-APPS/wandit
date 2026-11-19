import { describe, expect, it } from "vitest";

import {
	buildShareUrl,
	isActivationWindowOpen,
	isFinalClaimRefusal,
	parseInviteCode,
	parseInviteCodeOfDestination,
	removeInviteParam,
	type ShareContent,
} from "./helpers";

describe("parseInviteCode", () => {
	it.each([
		{ name: "a valid code", search: "?invite=abcd1234", code: "abcd1234" },
		{
			name: "a valid code between other parameters",
			search: "?auth=required&invite=0v9zk3mq&next=%2Fdashboard",
			code: "0v9zk3mq",
		},
		{ name: "no query", search: "", code: null },
		{
			name: "the affiliate parameter",
			search: "?ref=abcd1234",
			code: null,
		},
		{ name: "an empty value", search: "?invite=", code: null },
		{ name: "7 characters", search: "?invite=abcd123", code: null },
		{ name: "9 characters", search: "?invite=abcd12345", code: null },
		{ name: "capital letters", search: "?invite=ABCD1234", code: null },
		{
			name: "the letter i, which the alphabet does not have",
			search: "?invite=abci1234",
			code: null,
		},
		{
			name: "a space after the code",
			search: "?invite=abcd1234%20",
			code: null,
		},
		{
			name: "a script in the value",
			search: "?invite=%3Cscript%3E",
			code: null,
		},
	])("reads $name as $code", ({ search, code }) => {
		expect(parseInviteCode(search)).toBe(code);
	});
});

describe("parseInviteCodeOfDestination", () => {
	it.each([
		{
			// A split on "?" joins the hash to the code, and the code then fails the check.
			name: "a code in `next`, before a hash",
			search: "?next=%2Fdashboard%3Finvite%3Dabcd1234%23top",
			code: "abcd1234",
		},
		{
			name: "a `next` without a code",
			search: "?next=%2Fdashboard",
			code: null,
		},
		{
			// `new URL` throws for this text. The capture runs in the root route, so a throw breaks each page.
			name: "a `next` that is not a URL",
			search: "?next=http%3A%2F%2F",
			code: null,
		},
	])("reads $name as $code", ({ search, code }) => {
		expect(parseInviteCodeOfDestination(search)).toBe(code);
	});
});

describe("removeInviteParam", () => {
	it.each([
		{
			name: "drops the question mark with the only parameter",
			href: "https://wandit.dev/dashboard?invite=abcd1234",
			address: "https://wandit.dev/dashboard",
		},
		{
			name: "keeps the other parameters and the hash",
			href: "https://wandit.dev/?auth=required&invite=abcd1234&next=%2Fdashboard#pricing",
			address: "https://wandit.dev/?auth=required&next=%2Fdashboard#pricing",
		},
		{
			// The OAuth pages read the raw query. An address without the parameter gets no new text.
			name: "gives null without the parameter",
			href: "https://wandit.dev/oauth/authorize?client_id=a%20b&ref=abcd1234",
			address: null,
		},
	])("$name", ({ href, address }) => {
		expect(removeInviteParam(href)).toBe(address);
	});
});

describe("buildShareUrl", () => {
	// The text holds a space, an accent, "&", ":", and a link with "?" and "=". Each must stay inside one parameter.
	const content: ShareContent = {
		text: "Get 10 crédits & more: https://wandit.dev/?invite=abcd1234",
		inviteUrl: "https://wandit.dev/?invite=abcd1234",
		emailSubject: "10 credits + Wandit?",
	};
	const encodedText =
		"Get%2010%20cr%C3%A9dits%20%26%20more%3A%20https%3A%2F%2Fwandit.dev%2F%3Finvite%3Dabcd1234";

	it.each([
		{ target: "whatsapp", url: `https://wa.me/?text=${encodedText}` },
		{
			target: "x",
			url: `https://twitter.com/intent/tweet?text=${encodedText}`,
		},
		{
			target: "facebook",
			url: "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwandit.dev%2F%3Finvite%3Dabcd1234",
		},
		{
			target: "email",
			url: `mailto:?subject=10%20credits%20%2B%20Wandit%3F&body=${encodedText}`,
		},
	] as const)("encodes the message for $target", ({ target, url }) => {
		expect(buildShareUrl(target, content)).toBe(url);
	});
});

describe("isFinalClaimRefusal", () => {
	it.each([
		{ statusCode: 400, isFinal: true },
		{ statusCode: 404, isFinal: true },
		{ statusCode: 401, isFinal: false },
		{ statusCode: 429, isFinal: false },
		{ statusCode: 500, isFinal: false },
		// The API client gives the status 0 to a network error.
		{ statusCode: 0, isFinal: false },
	])("gives $isFinal for the status $statusCode", ({ statusCode, isFinal }) => {
		expect(isFinalClaimRefusal(statusCode)).toBe(isFinal);
	});
});

describe("isActivationWindowOpen", () => {
	const joinedAt = "2026-03-01T12:00:00.000Z";

	it.each([
		{
			name: "one minute before day 30",
			now: "2026-03-31T11:59:00.000Z",
			open: true,
		},
		{ name: "at day 30", now: "2026-03-31T12:00:00.000Z", open: false },
		{ name: "after day 30", now: "2026-04-15T12:00:00.000Z", open: false },
	])("is $open $name", ({ now, open }) => {
		expect(isActivationWindowOpen(joinedAt, new Date(now))).toBe(open);
	});
});
