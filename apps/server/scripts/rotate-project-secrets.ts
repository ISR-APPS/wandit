/**
 * Re-encrypts every `project_secrets` row and every desktop updater key
 * that an older key version wrote (WANDIT-185, docs/v2/desktop-apps.md).
 * Step 3 of the key rotation in `docs/v2/runbook.md`: run it after the API
 * deploys with the new version in `APP_SECRETS_ENCRYPTION_KEY`. Reads
 * `DATABASE_URL` and the key from the env like the other scripts and calls
 * `rotateProjectSecrets` and `rotateDesktopUpdaterKeys`. Exit code 1 when a
 * row failed.
 *
 * Usage (from apps/server):
 *   pnpm secrets:rotate
 */
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";

import { DesktopBuildsRepository } from "../src/modules/app-builder/infrastructure/persistence/desktop-builds.repository";
import { ProjectSecretsRepository } from "../src/modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { rotateDesktopUpdaterKeys } from "../src/modules/app-builder/infrastructure/secrets/rotate-desktop-updater-keys";
import { rotateProjectSecrets } from "../src/modules/app-builder/infrastructure/secrets/rotate-project-secrets";
import { parseSecretKeyRing } from "../src/modules/app-builder/infrastructure/secrets/secret-crypto";

if (env.APP_SECRETS_ENCRYPTION_KEY === undefined) {
	throw new Error("APP_SECRETS_ENCRYPTION_KEY is not set");
}
const ring = parseSecretKeyRing(env.APP_SECRETS_ENCRYPTION_KEY);
// The rotation runs one query at a time, so one connection is enough.
const db = createDb({ max: 1 });
const log = (line: string) => process.stdout.write(`${line}\n`);

try {
	const secrets = await rotateProjectSecrets({
		log,
		ring,
		secrets: new ProjectSecretsRepository(db),
	});
	log(
		`Rotated ${secrets.rotated} project secrets to v${ring.currentVersion}; ${secrets.skipped} skipped; ${secrets.failed} failed`,
	);
	const desktopKeys = await rotateDesktopUpdaterKeys({
		apps: new DesktopBuildsRepository(db),
		log,
		ring,
	});
	log(
		`Rotated ${desktopKeys.rotated} desktop updater keys to v${ring.currentVersion}; ${desktopKeys.skipped} skipped; ${desktopKeys.failed} failed`,
	);
	if (secrets.failed > 0 || desktopKeys.failed > 0) {
		process.exitCode = 1;
	}
} finally {
	await db.$client.end();
}
