import { aiChatCreditsSettledDataSchema } from "@wandit/contracts/v1/ai-chat";
import {
	creditActivityItemSchema,
	creditActivityResponseSchema,
	creditBalanceResponseSchema,
	creditsRoutes,
} from "@wandit/contracts/v1/credits";
import { describe, expect, it } from "vitest";

const balance = {
	plan: 10,
	promo: 0,
	topup: 2.5,
	balance: 12.5,
	settledBalance: 13.11,
	settledPlan: 10.61,
	settledPromo: 0,
	settledTopup: 2.5,
};

describe("creditBalanceResponseSchema", () => {
	it("accepts settled buckets", () => {
		expect(creditBalanceResponseSchema.parse(balance)).toEqual(balance);
	});

	it("requires settled buckets", () => {
		const { settledPlan: _plan, ...missing } = balance;
		expect(creditBalanceResponseSchema.safeParse(missing).success).toBe(false);
	});
});

describe("creditActivityItemSchema", () => {
	const id = "7f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b";

	it("accepts an in-progress usage row with null credits", () => {
		const row = {
			id,
			kind: "usage",
			operation: "chat",
			status: "in_progress",
			credits: null,
			ledgerKind: null,
			bucket: null,
			reason: null,
			createdAt: "2026-08-23T10:00:00.000Z",
			finalizedAt: null,
		};
		expect(creditActivityItemSchema.parse(row)).toEqual(row);
	});

	it("accepts a ledger grant row", () => {
		const row = {
			id,
			kind: "ledger",
			operation: null,
			status: "settled",
			credits: 50,
			ledgerKind: "grant",
			bucket: "promo",
			reason: "signup",
			createdAt: "2026-08-23T10:00:00.000Z",
			finalizedAt: null,
		};
		expect(creditActivityItemSchema.parse(row)).toEqual(row);
	});

	it("rejects unknown operations and statuses", () => {
		expect(
			creditActivityItemSchema.safeParse({
				id,
				kind: "usage",
				operation: "unknown",
				status: "settled",
				credits: -0.39,
				ledgerKind: null,
				bucket: null,
				reason: null,
				createdAt: "2026-08-23T10:00:00.000Z",
				finalizedAt: "2026-08-23T10:00:05.000Z",
			}).success,
		).toBe(false);
		expect(
			creditActivityItemSchema.safeParse({
				id,
				kind: "usage",
				operation: "chat",
				status: "failed",
				credits: null,
				ledgerKind: null,
				bucket: null,
				reason: null,
				createdAt: "2026-08-23T10:00:00.000Z",
				finalizedAt: null,
			}).success,
		).toBe(false);
	});

	it("paginates and exposes the activity route", () => {
		expect(
			creditActivityResponseSchema.safeParse({
				items: [],
				total: 0,
				page: 1,
				pageSize: 10,
			}).success,
		).toBe(true);
		expect(creditsRoutes.activity).toBe("/api/v1/credits/activity");
	});
});

describe("aiChatCreditsSettledDataSchema", () => {
	it("accepts a settle signal", () => {
		const data = {
			usageEventId: "evt_1",
			credits: 0.39,
			settledBalance: 12.72,
		};
		expect(aiChatCreditsSettledDataSchema.parse(data)).toEqual(data);
	});

	it("rejects a negative charge", () => {
		expect(
			aiChatCreditsSettledDataSchema.safeParse({
				usageEventId: "evt_1",
				credits: -1,
				settledBalance: 12.72,
			}).success,
		).toBe(false);
	});
});
