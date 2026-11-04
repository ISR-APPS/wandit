import { NotFoundException } from "@nestjs/common";
import { APP_AI_KEY_SECRET_NAME } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { AppBackendRow } from "../../infrastructure/persistence/app-backends.repository";
import {
	jsonResponse,
	type RecordedRequest,
} from "../../infrastructure/supabase/fake-supabase-fetch";
import {
	ACTIVE_BACKEND_ROW,
	createBackendToolFixture,
} from "../host-tools/backend/fake-backend-tool-deps";
import type { AppAiKeyAction } from "./app-ai-keys";
import { AppAiKeysService } from "./app-ai-keys.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const STORED_AT = "2026-11-01T08:00:00.000Z";

// The body of one Supabase `POST /projects/{ref}/secrets` call.
const pushedSecretsSchema = z.array(
	z.object({ name: z.string(), value: z.string() }),
);

function pushedSecrets(request: RecordedRequest | undefined) {
	return pushedSecretsSchema.parse(JSON.parse(request?.body ?? "null"));
}

/** The service on the backend tool fixture, with an in-memory key row. */
async function setup(options: {
	/** The key row before the call; null means the project has none. */
	storedKey: string | null;
	backend?: AppBackendRow | null;
	/** A key that another write stores while this call pushes; absent for none. */
	keyStoredDuringPush?: string;
	/** The engine of the project in the caller scope; null means out of scope. Default "v2_app". */
	engine?: "v2_app" | null;
}) {
	const fixture = await createBackendToolFixture({
		answers: [jsonResponse(201, ""), jsonResponse(201, "")],
		backend: options.backend,
	});
	let storedKey = options.storedKey;
	const engine = options.engine === undefined ? "v2_app" : options.engine;
	const service = new AppAiKeysService(
		{ findEngineByIdForScope: async () => engine },
		fixture.deps.backends,
		fixture.deps.client,
		{
			listNames: async () => ({
				secrets:
					storedKey === null
						? []
						: [
								{
									createdAt: STORED_AT,
									kind: "system",
									name: APP_AI_KEY_SECRET_NAME,
									updatedAt: STORED_AT,
								},
							],
			}),
			// The service reads the key back only after its first push.
			readSystemValue: async () => {
				storedKey = options.keyStoredDuringPush ?? storedKey;
				return storedKey;
			},
			removeSystem: async () => {
				storedKey = null;
			},
			set: async (_projectId, _name, value) => {
				storedKey = value;
				return "row-1";
			},
			setSystemIfAbsent: async (_projectId, _name, value) => {
				storedKey ??= value;
				return storedKey;
			},
		},
		fixture.deps.audit,
		{ monthlyBilledUsage: async () => ({ credits: 0, requests: 0 }) },
	);
	return { fixture, readStoredKey: () => storedKey, service };
}

describe("AppAiKeysService.writeKey", () => {
	it("enable keeps the stored key, pushes it with the gateway URL, and never answers it", async () => {
		const { fixture, readStoredKey, service } = await setup({
			storedKey: "wnd_ai_stored",
		});

		const status = await service.writeKey("enable", SCOPE, "project-1", null);

		expect(readStoredKey()).toBe("wnd_ai_stored");
		expect(pushedSecrets(fixture.requests[0])).toEqual([
			{ name: "WANDIT_AI_API_KEY", value: "wnd_ai_stored" },
			{
				name: "WANDIT_AI_GATEWAY_URL",
				value: expect.stringMatching(/^https?:\/\/[^/]+\/api\/v2\/ai\/v1$/),
			},
		]);
		expect(status.enabled).toBe(true);
		expect(
			JSON.stringify([status, fixture.audits, fixture.infos, fixture.warnings]),
		).not.toContain("wnd_ai_stored");
	});

	// Security: a foreign project id must not learn the backend state or
	// stamp the backend activity.
	it("answers 404 before the backend check when the project is out of scope", async () => {
		const { fixture, readStoredKey, service } = await setup({
			engine: null,
			storedKey: "wnd_ai_old",
		});

		await expect(
			service.writeKey("rotate", SCOPE, "project-1", null),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.requests).toEqual([]);
		expect(fixture.touches).toEqual([]);
		expect(readStoredKey()).toBe("wnd_ai_old");
	});

	it("rotate stores a new key and pushes that key", async () => {
		const { fixture, readStoredKey, service } = await setup({
			storedKey: "wnd_ai_old",
		});

		await service.writeKey("rotate", SCOPE, "project-1", null);

		expect(readStoredKey()).not.toBe("wnd_ai_old");
		expect(pushedSecrets(fixture.requests[0])[0]).toEqual({
			name: "WANDIT_AI_API_KEY",
			value: readStoredKey(),
		});
	});

	// Without the second send, Supabase keeps a key the DB no longer holds.
	it("rotate pushes the stored key again when another write lands during the push", async () => {
		const { fixture, service } = await setup({
			keyStoredDuringPush: "wnd_ai_other",
			storedKey: "wnd_ai_old",
		});

		await service.writeKey("rotate", SCOPE, "project-1", null);

		expect(fixture.requests).toHaveLength(2);
		expect(pushedSecrets(fixture.requests[1])[0]).toEqual({
			name: "WANDIT_AI_API_KEY",
			value: "wnd_ai_other",
		});
	});

	// A write without the push would leave the app with a dead key.
	it.each<{
		action: AppAiKeyAction;
		backend: AppBackendRow | null;
		storedKey: string | null;
		code: string;
	}>([
		{
			action: "enable",
			backend: { ...ACTIVE_BACKEND_ROW, status: "paused" },
			code: "BACKEND_PAUSED",
			storedKey: null,
		},
		{
			action: "rotate",
			backend: null,
			code: "BACKEND_NOT_READY",
			storedKey: "wnd_ai_old",
		},
	])("$action answers $code and writes no key", async ({
		action,
		backend,
		code,
		storedKey,
	}) => {
		const { fixture, readStoredKey, service } = await setup({
			backend,
			storedKey,
		});

		await expect(
			service.writeKey(action, SCOPE, "project-1", null),
		).rejects.toMatchObject({ response: { code } });
		expect(readStoredKey()).toBe(storedKey);
		expect(fixture.requests).toEqual([]);
	});
});
