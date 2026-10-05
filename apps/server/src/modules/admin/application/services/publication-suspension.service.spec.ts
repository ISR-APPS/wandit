import { env } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

import type { AuditRecord } from "../../../app-builder/application/services/audit-events.service";
import type { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import type {
	AdminProjectSuspension,
	AdminSuspensionTargetRow,
} from "../../infrastructure/persistence/admin.repository";
import { PublicationSuspensionService } from "./publication-suspension.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR = { id: "admin-1" };
const IP = "203.0.113.7";

type HostPointerValue = Parameters<DomainRoutingService["putHostPointer"]>[1];

/** Every write the service makes, in call order. */
type Write =
	| { kind: "state"; suspension: AdminProjectSuspension | null }
	| { kind: "host"; host: string; pointer: HostPointerValue }
	| { kind: "domains"; pointer: HostPointerValue }
	| { kind: "audit"; event: AuditRecord };

function appTarget(
	overrides: Partial<AdminSuspensionTargetRow> = {},
): AdminSuspensionTargetRow {
	return {
		engine: "v2_app",
		deletedAt: null,
		organizationId: "org-1",
		suspendedReasonCode: null,
		liveSlug: "launch",
		...overrides,
	};
}

function setup({
	target,
	kvFails = false,
	concurrentWrite = {},
}: {
	target: AdminSuspensionTargetRow | null;
	kvFails?: boolean;
	/** Fields that a publish or a second admin change right after the state write. */
	concurrentWrite?: Partial<AdminSuspensionTargetRow>;
}) {
	const writes: Write[] = [];
	// The fake row follows each state write, like the `projects` row.
	let row = target;
	const service = new PublicationSuspensionService(
		{
			findSuspensionTarget: async () => row,
			setProjectSuspension: async (_projectId, suspension) => {
				writes.push({ kind: "state", suspension });
				if (row !== null) {
					row = {
						...row,
						suspendedReasonCode: suspension?.reasonCode ?? null,
						...concurrentWrite,
					};
				}
				return true;
			},
		},
		{
			isKvConfigured: () => true,
			putHostPointer: async (host, pointer) => {
				if (kvFails) {
					throw new Error("Cloudflare domain routing request failed");
				}
				writes.push({ kind: "host", host, pointer });
			},
			refreshProjectDomains: async (_projectId, pointer) => {
				writes.push({ kind: "domains", pointer });
			},
		},
		{
			record: async (event) => {
				writes.push({ kind: "audit", event });
			},
		},
	);

	return { service, writes };
}

describe("PublicationSuspensionService", () => {
	it("suspends: state first, then the suspended pointer on the slug host and every domain, then one audit row", async () => {
		const { service, writes } = setup({ target: appTarget() });

		const result = await service.suspend(
			ACTOR,
			PROJECT_ID,
			{ reasonCode: "abuse_phishing", note: "Fake bank login" },
			IP,
		);

		expect(writes.map((write) => write.kind)).toEqual([
			"state",
			"host",
			"domains",
			"audit",
		]);
		expect(writes[0]).toMatchObject({
			suspension: { note: "Fake bank login", reasonCode: "abuse_phishing" },
		});
		expect(writes[1]).toMatchObject({
			host: `launch.${env.SITES_DOMAIN}`,
			pointer: {
				kind: "app",
				projectId: PROJECT_ID,
				reasonCode: "abuse_phishing",
				slug: "launch",
				source: "slug",
				status: "suspended",
			},
		});
		expect(writes[2]).toMatchObject({
			pointer: {
				kind: "app",
				projectId: PROJECT_ID,
				reasonCode: "abuse_phishing",
				source: "domain",
				status: "suspended",
			},
		});
		expect(writes[3]).toMatchObject({
			event: {
				action: "project.suspend",
				actorUserId: "admin-1",
				ip: IP,
				metadata: { note: "Fake bank login", reasonCode: "abuse_phishing" },
				organizationId: "org-1",
				projectId: PROJECT_ID,
			},
		});
		expect(result.suspension?.reasonCode).toBe("abuse_phishing");
	});

	it("unsuspends: clears the state and writes pointers without the suspended status", async () => {
		const { service, writes } = setup({
			target: appTarget({ suspendedReasonCode: "abuse_phishing" }),
		});

		const result = await service.unsuspend(ACTOR, PROJECT_ID, IP);

		expect(writes.map((write) => write.kind)).toEqual([
			"state",
			"host",
			"domains",
			"audit",
		]);
		expect(writes[0]).toEqual({ kind: "state", suspension: null });
		for (const write of writes.slice(1, 3)) {
			expect(write).toMatchObject({ pointer: { kind: "app" } });
			expect(write).not.toHaveProperty("pointer.status");
			expect(write).not.toHaveProperty("pointer.reasonCode");
		}
		expect(writes[3]).toMatchObject({
			event: {
				action: "project.unsuspend",
				metadata: { note: null, reasonCode: "abuse_phishing" },
			},
		});
		expect(result).toEqual({ projectId: PROJECT_ID, suspension: null });
	});

	it.each([
		{ name: "a missing project", target: null, error: { status: 404 } },
		{
			name: "a soft-deleted project",
			target: appTarget({ deletedAt: new Date("2026-09-01T00:00:00Z") }),
			error: { status: 404 },
		},
		{
			name: "a V1 page",
			target: appTarget({ engine: "v1_page" }),
			error: { response: { code: "SUSPEND_UNSUPPORTED" }, status: 409 },
		},
	])("refuses $name and writes nothing", async ({ target, error }) => {
		const { service, writes } = setup({ target });

		await expect(
			service.suspend(ACTOR, PROJECT_ID, { reasonCode: "billing" }, IP),
		).rejects.toMatchObject(error);
		expect(writes).toEqual([]);
	});

	it.each([
		{
			name: "a slug that goes live after the first read",
			target: appTarget({ liveSlug: null }),
			concurrentWrite: { liveSlug: "launch" },
			status: "suspended",
		},
		{
			name: "an unsuspend by a second admin after the state write",
			target: appTarget(),
			concurrentWrite: { suspendedReasonCode: null },
			status: undefined,
		},
	])("writes the pointers from the row read after the state write: $name", async ({
		concurrentWrite,
		status,
		target,
	}) => {
		const { service, writes } = setup({ concurrentWrite, target });

		await service.suspend(ACTOR, PROJECT_ID, { reasonCode: "billing" }, IP);

		const pointers = writes.flatMap((write) =>
			write.kind === "host" || write.kind === "domains"
				? [{ kind: write.kind, status: write.pointer.status }]
				: [],
		);
		expect(pointers).toEqual([
			{ kind: "host", status },
			{ kind: "domains", status },
		]);
		expect(writes[1]).toMatchObject({ host: `launch.${env.SITES_DOMAIN}` });
	});

	it("keeps the state and the audit row when KV fails, and tells the admin to send the call again", async () => {
		const { service, writes } = setup({ kvFails: true, target: appTarget() });

		await expect(
			service.suspend(ACTOR, PROJECT_ID, { reasonCode: "billing" }, IP),
		).rejects.toMatchObject({
			response: { code: "SUSPENSION_HOSTS_NOT_UPDATED" },
			status: 502,
		});
		expect(writes.map((write) => write.kind)).toEqual(["state", "audit"]);
	});
});
