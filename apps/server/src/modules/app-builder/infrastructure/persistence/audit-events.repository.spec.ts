import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AuditEventsRepository } from "./audit-events.repository";

describe("AuditEventsRepository", () => {
	it("insert appends one audit_events row", async () => {
		const values = vi.fn(async () => undefined);
		const insert = vi.fn(() => ({ values }));
		const repository = new AuditEventsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// insert chain the method uses.
			Object.assign(Object.create(null), { insert }) as Database,
		);

		await repository.insert({
			action: "project.deleted",
			actorUserId: "user-1",
			metadata: { deletedObjects: 3 },
			organizationId: "org-1",
			projectId: "project-1",
			targetId: "project-1",
			targetType: "project",
		});

		expect(values).toHaveBeenCalledWith({
			action: "project.deleted",
			actorUserId: "user-1",
			metadata: { deletedObjects: 3 },
			organizationId: "org-1",
			projectId: "project-1",
			targetId: "project-1",
			targetType: "project",
		});
	});

	it("insert passes metadata null through to the row", async () => {
		const values = vi.fn(async () => undefined);
		const insert = vi.fn(() => ({ values }));
		const repository = new AuditEventsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// insert chain the method uses.
			Object.assign(Object.create(null), { insert }) as Database,
		);

		await repository.insert({
			action: "project.deleted",
			actorUserId: "user-1",
			metadata: null,
			organizationId: "org-1",
			projectId: "project-1",
			targetId: "project-1",
			targetType: "project",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ metadata: null }),
		);
	});

	it("insert writes the client ip when the caller passes one", async () => {
		const values = vi.fn(async () => undefined);
		const insert = vi.fn(() => ({ values }));
		const repository = new AuditEventsRepository(
			// SAFETY: `Object.create` yields any; the stub exposes only the
			// insert chain the method uses.
			Object.assign(Object.create(null), { insert }) as Database,
		);

		await repository.insert({
			action: "secret.set",
			actorUserId: "user-1",
			ip: "203.0.113.9",
			metadata: { kind: "user", name: "STRIPE_SECRET_KEY" },
			organizationId: null,
			projectId: "project-1",
			targetId: "row-1",
			targetType: "project_secret",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ ip: "203.0.113.9" }),
		);
	});
});
