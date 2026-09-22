/**
 * Re-encrypts every `project_secrets` row that an older key version wrote
 * (WANDIT-185). Step 3 of the key rotation in `docs/v2/runbook.md`: run it
 * after the API deploys with the new version in `APP_SECRETS_ENCRYPTION_KEY`.
 * Reads `DATABASE_URL` and the key from the env like the other scripts and
 * calls `rotateProjectSecrets`. Exit code 1 when a row failed.
 *
 * Usage (from apps/server):
 *   pnpm secrets:rotate
 */
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";

import { ProjectSecretsRepository } from "../src/modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { rotateProjectSecrets } from "../src/modules/app-builder/infrastructure/secrets/rotate-project-secrets";
import { parseSecretKeyRing } from "../src/modules/app-builder/infrastructure/secrets/secret-crypto";

if (env.APP_SECRETS_ENCRYPTION_KEY === undefined) {
	throw new Error("APP_SECRETS_ENCRYPTION_KEY is not set");
}
const ring = parseSecretKeyRing(env.APP_SECRETS_ENCRYPTION_KEY);
// The rotation runs one query at a time, so one connection is enough.
const db = createDb({ max: 1 });

try {
	const report = await rotateProjectSecrets({
		log: (line) => process.stdout.write(`${line}\n`),
		ring,
		secrets: new ProjectSecretsRepository(db),
	});
	process.stdout.write(
		`Rotated ${report.rotated} rows to v${ring.currentVersion}; ${report.skipped} skipped; ${report.failed} failed\n`,
	);
	if (report.failed > 0) {
		process.exitCode = 1;
	}
} finally {
	await db.$client.end();
}
