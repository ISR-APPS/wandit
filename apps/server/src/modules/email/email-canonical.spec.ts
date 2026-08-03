import { canonicalizeEmail } from "@wandit/auth/email-canonical";
import { describe, expect, it } from "vitest";

// The one-inbox-one-account invariant. Keep in lockstep with the SQL
// backfill expression in packages/db/src/migrations/0020_moaning_whiplash.sql.
describe("canonicalizeEmail", () => {
	it("trims and lowercases", () => {
		expect(canonicalizeEmail("  Zack@Example.COM ")).toBe("zack@example.com");
	});

	it("strips one +suffix on every domain", () => {
		expect(canonicalizeEmail("zack+spam@example.com")).toBe(
			"zack@example.com",
		);
		expect(canonicalizeEmail("zack+a+b@example.com")).toBe(
			"zack@example.com",
		);
	});

	it("drops gmail dots and normalizes googlemail to gmail.com", () => {
		expect(canonicalizeEmail("first.last@gmail.com")).toBe(
			"firstlast@gmail.com",
		);
		expect(canonicalizeEmail("f.i.r.s.t+promo@googlemail.com")).toBe(
			"first@gmail.com",
		);
	});

	it("preserves dots outside gmail", () => {
		expect(canonicalizeEmail("first.last@company.com")).toBe(
			"first.last@company.com",
		);
	});

	it("collapses every alias of one gmail inbox to a single identity", () => {
		const variants = [
			"burner@gmail.com",
			"b.u.r.n.e.r@gmail.com",
			"burner+1@gmail.com",
			"b.urner+xyz@googlemail.com",
			"BURNER@GMAIL.COM",
		];
		const canonical = new Set(variants.map(canonicalizeEmail));
		expect(canonical).toEqual(new Set(["burner@gmail.com"]));
	});

	it("is idempotent", () => {
		for (const input of [
			"first.last+tag@googlemail.com",
			"user@company.co.uk",
			"a@b",
		]) {
			const once = canonicalizeEmail(input);
			expect(canonicalizeEmail(once)).toBe(once);
		}
	});

	it("passes non-address garbage through for zod to reject downstream", () => {
		expect(canonicalizeEmail("not-an-email")).toBe("not-an-email");
		expect(canonicalizeEmail("+tag@gmail.com")).toBe("@gmail.com");
	});
});
