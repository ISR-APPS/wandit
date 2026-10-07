import { describe, expect, it } from "vitest";

import type { ProjectSecretCipherRow } from "../persistence/project-secrets.repository";
import {
	ROTATION_BATCH_SIZE,
	rotateProjectSecrets,
} from "./rotate-project-secrets";
import {
	decryptSecret,
	encryptSecret,
	parseSecretKeyRing,
} from "./secret-crypto";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");
const OLD_RING = parseSecretKeyRing(`v1:${KEY_V1}`);
const NEW_RING = parseSecretKeyRing(`v1:${KEY_V1},v2:${KEY_V2}`);

/** In-memory `project_secrets`: the two rotation methods over a row array. */
function fakeRepository(rows: ProjectSecretCipherRow[]) {
	return {
		rows,
		async listBelowKeyVersion(
			keyVersion: number,
			afterId: string | null,
			limit: number,
		) {
			return (
				rows
					.filter(
						(row) =>
							row.keyVersion < keyVersion &&
							(afterId === null || row.id > afterId),
					)
					.sort((left, right) => left.id.localeCompare(right.id))
					.slice(0, limit)
					// A database read answers a copy; a later write to `rows` must
					// not change the page the rotation holds.
					.map((row) => ({ ...row }))
			);
		},
		async replaceCipher(
			id: string,
			expectedKeyVersion: number,
			next: { ciphertext: string; keyVersion: number },
		) {
			const row = rows.find((candidate) => candidate.id === id);
			if (row === undefined || row.keyVersion !== expectedKeyVersion) {
				return false;
			}
			row.ciphertext = next.ciphertext;
			row.keyVersion = next.keyVersion;
			return true;
		},
	};
}

function oldRow(index: number): ProjectSecretCipherRow {
	const id = `row-${String(index).padStart(4, "0")}`;
	const identity = { name: "STRIPE_SECRET_KEY", projectId: `project-${index}` };
	return {
		id,
		...identity,
		...encryptSecret(OLD_RING, identity, `value-${index}`),
	};
}

describe("rotateProjectSecrets", () => {
	it("moves every older row to the current version across pages and keeps the values", async () => {
		const rows = Array.from({ length: ROTATION_BATCH_SIZE + 5 }, (_, index) =>
			oldRow(index),
		);
		const secrets = fakeRepository(rows);
		const lines: string[] = [];

		const report = await rotateProjectSecrets({
			log: (line) => lines.push(line),
			ring: NEW_RING,
			secrets,
		});

		expect(report).toEqual({
			failed: 0,
			rotated: ROTATION_BATCH_SIZE + 5,
			skipped: 0,
		});
		expect(rows.every((row) => row.keyVersion === 2)).toBe(true);
		expect(
			decryptSecret(
				parseSecretKeyRing(`v2:${KEY_V2}`),
				{ name: "STRIPE_SECRET_KEY", projectId: "project-3" },
				rows[3]?.ciphertext ?? "",
				2,
			),
		).toBe("value-3");
		expect(lines.filter((line) => line.startsWith("rotate.page"))).toHaveLength(
			2,
		);
	});

	it("leaves a row on the current version alone", async () => {
		const identity = { name: "NAME", projectId: "project-1" };
		const current: ProjectSecretCipherRow = {
			id: "row-1",
			...identity,
			...encryptSecret(NEW_RING, identity, "fresh"),
		};
		const before = current.ciphertext;

		const report = await rotateProjectSecrets({
			log: () => undefined,
			ring: NEW_RING,
			secrets: fakeRepository([current]),
		});

		expect(report.rotated).toBe(0);
		expect(current.ciphertext).toBe(before);
	});

	it("counts a row that cannot decrypt as failed and still ends", async () => {
		const broken = { ...oldRow(1), ciphertext: "AAAA" };
		const lines: string[] = [];

		const report = await rotateProjectSecrets({
			log: (line) => lines.push(line),
			ring: NEW_RING,
			secrets: fakeRepository([broken, oldRow(2)]),
		});

		expect(report).toEqual({ failed: 1, rotated: 1, skipped: 0 });
		expect(broken.keyVersion).toBe(1);
		expect(lines[0]).toContain("rotate.failed id=row-0001 keyVersion=1");
	});

	it("counts a row a user rewrote during the run as skipped", async () => {
		const row = oldRow(1);
		const secrets = fakeRepository([row]);
		// The user write lands between the page read and the CAS write.
		const listBelowKeyVersion = secrets.listBelowKeyVersion.bind(secrets);
		secrets.listBelowKeyVersion = async (keyVersion, afterId, limit) => {
			const page = await listBelowKeyVersion(keyVersion, afterId, limit);
			row.keyVersion = 2;
			return page;
		};

		const report = await rotateProjectSecrets({
			log: () => undefined,
			ring: NEW_RING,
			secrets,
		});

		expect(report).toEqual({ failed: 0, rotated: 0, skipped: 1 });
	});
});
