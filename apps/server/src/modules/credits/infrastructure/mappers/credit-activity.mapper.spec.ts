import { creditActivityItemSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { CreditActivityRow } from "../persistence/credits.repository";
import {
	mapCreditActivityPage,
	mapCreditActivityRow,
} from "./credit-activity.mapper";

const createdAt = new Date("2026-08-20T10:00:00.000Z");
const finalizedAt = new Date("2026-08-20T10:02:00.000Z");

function usage(
	input: Partial<Extract<CreditActivityRow, { source: "usage" }>>,
): CreditActivityRow {
	return {
		createdAt,
		finalCredits: null,
		finalizedAt: null,
		id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e01",
		operation: "chat",
		reservedCredits: 100,
		source: "usage",
		status: "reserved",
		...input,
	};
}

describe("mapCreditActivityRow", () => {
	it("shows an in-flight event with no amount", () => {
		const item = mapCreditActivityRow(usage({}));

		expect(item).toMatchObject({
			credits: null,
			finalizedAt: null,
			kind: "usage",
			operation: "chat",
			status: "in_progress",
		});
		expect(creditActivityItemSchema.parse(item)).toEqual(item);
	});

	it("folds reserve -100, settle refund +63 and reconcile -2 into ONE net row", () => {
		// The event's final_credits already carries the reconciled charge (39).
		const item = mapCreditActivityRow(
			usage({ finalCredits: 39, finalizedAt, status: "reconciled" }),
		);

		expect(item).toMatchObject({
			credits: -0.39,
			finalizedAt: "2026-08-20T10:02:00.000Z",
			status: "settled",
		});
	});

	it("shows a settled (not yet reconciled) event at its settle charge", () => {
		expect(
			mapCreditActivityRow(
				usage({ finalCredits: 37, finalizedAt, status: "settled" }),
			),
		).toMatchObject({ credits: -0.37, status: "settled" });
	});

	it("never shows 'reconcile failed': charges final_credits, else stays in progress", () => {
		expect(
			mapCreditActivityRow(
				usage({ finalCredits: 41, status: "reconcile_failed" }),
			),
		).toMatchObject({ credits: -0.41, status: "settled" });
		// Straight from reserved: the balance still adds the reserve back, so
		// the row must not show a charge (and never the reserve estimate).
		expect(
			mapCreditActivityRow(
				usage({ finalCredits: null, finalizedAt, status: "reconcile_failed" }),
			),
		).toMatchObject({
			credits: null,
			finalizedAt: null,
			status: "in_progress",
		});
	});

	it("shows a refunded event only by the charge that stayed", () => {
		expect(
			mapCreditActivityRow(usage({ finalCredits: 12, status: "refunded" })),
		).toMatchObject({ credits: -0.12, status: "refunded" });
		// The repository hides refunded rows with nothing charged; the mapper
		// still yields 0 (not -0) should one reach it.
		expect(
			mapCreditActivityRow(usage({ finalCredits: 0, status: "refunded" }))
				.credits,
		).toBe(0);
	});

	it("maps a ledger grant row with its bucket, kind and reason", () => {
		const item = mapCreditActivityRow({
			bucket: "promo",
			createdAt,
			delta: 500,
			id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
			ledgerKind: "grant",
			reason: "signup_grant",
			source: "ledger",
		});

		expect(item).toEqual({
			bucket: "promo",
			createdAt: "2026-08-20T10:00:00.000Z",
			credits: 5,
			finalizedAt: null,
			id: "3f1d2a36-2f9e-4d4b-9c2f-7c0d3f6a1e03",
			kind: "ledger",
			ledgerKind: "grant",
			operation: null,
			reason: "signup_grant",
			status: "settled",
		});
		expect(creditActivityItemSchema.parse(item)).toEqual(item);
	});
});

describe("mapCreditActivityPage", () => {
	it("keeps order, page and total", () => {
		const page = mapCreditActivityPage({
			items: [usage({}), usage({ finalCredits: 39, status: "settled" })],
			page: 3,
			pageSize: 2,
			total: 9,
		});

		expect(page.items.map((item) => item.credits)).toEqual([null, -0.39]);
		expect(page).toMatchObject({ page: 3, pageSize: 2, total: 9 });
	});
});
