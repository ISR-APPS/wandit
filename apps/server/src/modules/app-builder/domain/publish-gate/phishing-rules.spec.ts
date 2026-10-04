import { describe, expect, it } from "vitest";

import { findPhishingTerm } from "./phishing-rules";

describe("findPhishingTerm", () => {
	it.each([
		// The WANDIT-181 acceptance names.
		["paypa1-login", true],
		["baridimob-verify", true],
		["connexion-cpa", true],
		["تسجيل-الدخول.com", true],
		["xn----zmchimfy1lcc7br.com", true],
		["www.paypal-login.com", true],
		["my-shop", false],
		["cpanel-tips", false],
		["blogging-tips", false],
		// One row for each rule. Each row fails when its rule goes away.
		// "ccp" is a short term: it blocks as a whole token only.
		["ccp-algerie", true],
		// Cyrillic "\u0440" and "\u0430" in place of the Latin p and a.
		["xn--ypal-43d9g.com", true],
		// Cyrillic "\u043f" in place of n, in a label of Cyrillic letters only.
		["xn--80ak2abk6dtd.com", true],
		// Greek "\u03bf" in place of the Latin o.
		["xn--lgin-0nd.com", true],
		// "l\u00f8gin": NFKD keeps a letter with a stroke, so the map folds it.
		["xn--lgin-gra.com", true],
		// "b\u00f1a": the tilde goes away, so the short term "bna" stays whole.
		["xn--ba-zja.com", true],
		// The Arabic tatweel "\u0640" inside the listed word goes away.
		["xn--pgbeu6cva9a.com", true],
		// The Farsi yeh in place of the Arabic yeh.
		["xn--pgbeu3e50b.com", true],
		// A heh in place of the teh marbuta at the end of the listed word.
		["xn--sgbw0aon.com", true],
		["paypa1-shop", true],
		["paypaI-shop", true],
		["metarnask", true],
		["vvallet", true],
		// The "rn" fold alone turns this into "badmet".
		["badrnet", true],
		["pay-pal", true],
		// The TLD goes away, so "logi" + "net" does not make "login".
		["logi.net", false],
	])("%s is blocked: %s", (name, blocked) => {
		expect(findPhishingTerm(name) !== null).toBe(blocked);
	});
});
