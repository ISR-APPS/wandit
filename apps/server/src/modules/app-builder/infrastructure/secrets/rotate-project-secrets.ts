/**
 * Re-encrypts every `project_secrets` row that an older key version wrote
 * (WANDIT-185). `scripts/rotate-project-secrets.ts` calls it after the
 * operator deploys the new version; `docs/v2/runbook.md` has the steps.
 * Reads and writes through `ProjectSecretsRepository`, page by page.
 */
import { getErrorMessage } from "@wandit/observability/error";

import type {
	ProjectSecretCipherRow,
	ProjectSecretsRepository,
} from "../persistence/project-secrets.repository";
import {
	decryptSecret,
	encryptSecret,
	type SecretKeyRing,
} from "./secret-crypto";

/** Rows per page. 100 keeps one page under a second of AES work and one round trip. */
export const ROTATION_BATCH_SIZE = 100;

/** Counts of one run. `failed > 0` means the operator must look at the log. */
export type RotationReport = {
	/** Rows now on the current version. */
	rotated: number;
	/** Rows a user write moved to the current version during the run. */
	skipped: number;
	/** Rows that did not decrypt, for example a version missing from the ring. */
	failed: number;
};

/** What the rotation needs; the script wires the real ones, the spec fakes. */
export type RotateProjectSecretsDeps = {
	/** The parsed `APP_SECRETS_ENCRYPTION_KEY` with the old and the new version. */
	ring: SecretKeyRing;
	secrets: Pick<
		ProjectSecretsRepository,
		"listBelowKeyVersion" | "replaceCipher"
	>;
	/** One line per failed row and per page; `process.stdout` in the script. */
	log: (line: string) => void;
};

/**
 * Walks the rows below the current version by id and re-encrypts each one
 * with a compare-and-set on its key version. A row that fails stays where
 * it is: the id cursor moves past it, so the walk always ends.
 */
export async function rotateProjectSecrets(
	deps: RotateProjectSecretsDeps,
): Promise<RotationReport> {
	const report: RotationReport = { failed: 0, rotated: 0, skipped: 0 };
	let afterId: string | null = null;
	let page: ProjectSecretCipherRow[];
	do {
		page = await deps.secrets.listBelowKeyVersion(
			deps.ring.currentVersion,
			afterId,
			ROTATION_BATCH_SIZE,
		);
		for (const row of page) {
			afterId = row.id;
			const identity = { name: row.name, projectId: row.projectId };
			try {
				const plaintext = decryptSecret(
					deps.ring,
					identity,
					row.ciphertext,
					row.keyVersion,
				);
				const next = encryptSecret(deps.ring, identity, plaintext);
				const replaced = await deps.secrets.replaceCipher(
					row.id,
					row.keyVersion,
					next,
				);
				if (replaced) {
					report.rotated += 1;
				} else {
					report.skipped += 1;
				}
			} catch (error) {
				// The row keeps its old version; the operator fixes the ring and reruns.
				report.failed += 1;
				deps.log(
					`rotate.failed id=${row.id} keyVersion=${row.keyVersion}: ${getErrorMessage(error)}`,
				);
			}
		}
		deps.log(
			`rotate.page rotated=${report.rotated} skipped=${report.skipped} failed=${report.failed}`,
		);
		// A short page is the last one; a full page may hide more rows.
	} while (page.length === ROTATION_BATCH_SIZE);

	return report;
}
