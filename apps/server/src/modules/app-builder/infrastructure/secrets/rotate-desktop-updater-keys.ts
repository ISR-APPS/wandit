/**
 * Re-encrypts every desktop updater private key that an older
 * `APP_SECRETS_ENCRYPTION_KEY` version wrote (docs/v2/desktop-apps.md
 * section 8, step 5). `scripts/rotate-project-secrets.ts` calls it after the
 * project secrets. It runs the page walk of `rotateProjectSecrets` on the
 * `desktop_apps` rows through `DesktopBuildsRepository`.
 */
import { updaterKeyIdentity } from "../desktop/updater-signature";
import type { DesktopBuildsRepository } from "../persistence/desktop-builds.repository";
import {
	type RotationReport,
	rotateProjectSecrets,
} from "./rotate-project-secrets";
import type { SecretKeyRing } from "./secret-crypto";

/** What the rotation needs; the script wires the real ones, the spec fakes. */
export type RotateDesktopUpdaterKeysDeps = {
	/** The parsed `APP_SECRETS_ENCRYPTION_KEY` with the old and the new version. */
	ring: SecretKeyRing;
	apps: Pick<
		DesktopBuildsRepository,
		"listAppsBelowKeyVersion" | "replaceUpdaterKeyCipher"
	>;
	/** One line per failed row and per page; `process.stdout` in the script. */
	log: (line: string) => void;
};

/**
 * Moves each app key below the current version to the current version,
 * with a compare-and-set per row. The project id is the row id and the
 * AAD is `<project id>:DESKTOP_UPDATER_KEY`, as at encryption.
 */
export function rotateDesktopUpdaterKeys(
	deps: RotateDesktopUpdaterKeysDeps,
): Promise<RotationReport> {
	return rotateProjectSecrets({
		log: deps.log,
		ring: deps.ring,
		secrets: {
			listBelowKeyVersion: async (keyVersion, afterId, limit) =>
				(
					await deps.apps.listAppsBelowKeyVersion(keyVersion, afterId, limit)
				).map((row) => ({
					...updaterKeyIdentity(row.projectId),
					ciphertext: row.updaterPrivateKeyCiphertext,
					id: row.projectId,
					keyVersion: row.updaterKeyVersion,
				})),
			replaceCipher: (projectId, expectedKeyVersion, next) =>
				deps.apps.replaceUpdaterKeyCipher(projectId, expectedKeyVersion, next),
		},
	});
}
