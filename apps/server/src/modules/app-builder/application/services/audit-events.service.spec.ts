import { describe, expect, it } from "vitest";

import type { AuditEventInput } from "../../infrastructure/persistence/audit-events.repository";
import { AuditEventsService, type AuditRecord } from "./audit-events.service";

// The spec builds the fake key at run time, because GitHub push protection
// blocks a full key literal.
const stripeSecretKey = `sk_live_${"Ab3".repeat(8)}`;

const event: AuditRecord = {
	action: "publish.blocked",
	actorUserId: "user-1",
	metadata: {
		findingCount: 1,
		note: `The build holds ${stripeSecretKey} in a client asset`,
	},
	organizationId: null,
	projectId: "project-1",
	targetId: "build-1",
	targetType: "app_build",
};

describe("AuditEventsService", () => {
	it("masks a key inside a string metadata value", async () => {
		const rows: AuditEventInput[] = [];
		const service = new AuditEventsService(
			{
				insert: async (row) => {
					rows.push(row);
				},
			},
			{ error: () => undefined },
		);

		await service.record(event);

		expect(rows.map((row) => row.metadata)).toEqual([
			{
				findingCount: 1,
				note: "The build holds sk_live_…3Ab3 in a client asset",
			},
		]);
	});

	it("logs a failed insert and does not throw", async () => {
		const lines: { message: string; fields: Record<string, string> }[] = [];
		const service = new AuditEventsService(
			{ insert: () => Promise.reject(new Error("connection refused")) },
			{
				error: (message, fields) => {
					lines.push({ fields, message });
				},
			},
		);

		await expect(service.record(event)).resolves.toBeUndefined();
		expect(lines).toEqual([
			{
				fields: {
					action: "publish.blocked",
					error: "connection refused",
					projectId: "project-1",
				},
				message: "audit.write-failed",
			},
		]);
	});
});
