import { describe, expect, it } from "vitest";

import {
	decryptDesktopUpdaterKey,
	encryptDesktopUpdaterKey,
} from "../desktop/updater-signature";
import type { DesktopUpdaterKeyRow } from "../persistence/desktop-builds.repository";
import { rotateDesktopUpdaterKeys } from "./rotate-desktop-updater-keys";
import { parseSecretKeyRing } from "./secret-crypto";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");
const OLD_RING = parseSecretKeyRing(`v1:${KEY_V1}`);
const NEW_RING = parseSecretKeyRing(`v1:${KEY_V1},v2:${KEY_V2}`);

function appRow(
	projectId: string,
	ring: typeof OLD_RING,
	privateKeyPkcs8: string,
): DesktopUpdaterKeyRow {
	const encrypted = encryptDesktopUpdaterKey(ring, projectId, privateKeyPkcs8);
	return {
		projectId,
		updaterKeyVersion: encrypted.keyVersion,
		updaterPrivateKeyCiphertext: encrypted.ciphertext,
	};
}

describe("rotateDesktopUpdaterKeys", () => {
	// A wrong AAD in the adapter would write keys that the build task can
	// never decrypt, and no installed app could get an update again.
	it("re-encrypts only the old-version keys so that the task still decrypts them", async () => {
		const oldApp = appRow("project-a", OLD_RING, "old-key");
		const currentApp = appRow("project-b", NEW_RING, "current-key");
		const currentCipher = currentApp.updaterPrivateKeyCiphertext;
		const rows = [oldApp, currentApp];
		const apps = {
			listAppsBelowKeyVersion: async (
				keyVersion: number,
				afterProjectId: string | null,
				limit: number,
			) =>
				rows
					.filter(
						(row) =>
							row.updaterKeyVersion < keyVersion &&
							(afterProjectId === null || row.projectId > afterProjectId),
					)
					.slice(0, limit)
					.map((row) => ({ ...row })),
			replaceUpdaterKeyCipher: async (
				projectId: string,
				expectedKeyVersion: number,
				next: { ciphertext: string; keyVersion: number },
			) => {
				const row = rows.find((candidate) => candidate.projectId === projectId);
				if (row === undefined || row.updaterKeyVersion !== expectedKeyVersion) {
					return false;
				}
				row.updaterPrivateKeyCiphertext = next.ciphertext;
				row.updaterKeyVersion = next.keyVersion;
				return true;
			},
		};

		const report = await rotateDesktopUpdaterKeys({
			apps,
			log: () => undefined,
			ring: NEW_RING,
		});

		expect(report).toEqual({ failed: 0, rotated: 1, skipped: 0 });
		expect(oldApp.updaterKeyVersion).toBe(2);
		expect(decryptDesktopUpdaterKey(NEW_RING, oldApp)).toBe("old-key");
		expect(currentApp.updaterPrivateKeyCiphertext).toBe(currentCipher);
	});
});
