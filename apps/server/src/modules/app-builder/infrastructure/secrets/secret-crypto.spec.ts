import { describe, expect, it } from "vitest";

import {
	decryptSecret,
	encryptSecret,
	parseSecretKeyRing,
} from "./secret-crypto";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");
const ROW = { name: "STRIPE_SECRET_KEY", projectId: "project-1" };

describe("parseSecretKeyRing", () => {
	it("keeps every version and picks the highest as current", () => {
		const ring = parseSecretKeyRing(`v1:${KEY_V1}, v2:${KEY_V2}`);

		expect(ring.currentVersion).toBe(2);
		expect([...ring.keys.keys()]).toEqual([1, 2]);
	});

	it("rejects a malformed entry, a short key, a repeated version, and an empty value", () => {
		expect(() => parseSecretKeyRing(`1:${KEY_V1}`)).toThrow(
			"must look like v1:<base64>",
		);
		expect(() => parseSecretKeyRing("v1:c2hvcnQ=")).toThrow(
			"v1 must decode to 32 bytes",
		);
		expect(() => parseSecretKeyRing(`v1:${KEY_V1},v1:${KEY_V2}`)).toThrow(
			"lists v1 twice",
		);
		expect(() => parseSecretKeyRing("")).toThrow("must look like");
	});
});

describe("encryptSecret and decryptSecret", () => {
	const ring = parseSecretKeyRing(`v1:${KEY_V1}`);

	it("round-trips a value under the current version", () => {
		const encrypted = encryptSecret(ring, ROW, "sk_live_123");

		expect(encrypted.keyVersion).toBe(1);
		expect(encrypted.ciphertext).not.toContain("sk_live_123");
		expect(
			decryptSecret(ring, ROW, encrypted.ciphertext, encrypted.keyVersion),
		).toBe("sk_live_123");
	});

	it("refuses a ring whose current version has no key", () => {
		expect(() =>
			encryptSecret({ currentVersion: 3, keys: new Map() }, ROW, "value"),
		).toThrow("has no v3");
	});

	it("uses a fresh IV per write, so two writes of one value differ", () => {
		const first = encryptSecret(ring, ROW, "same");
		const second = encryptSecret(ring, ROW, "same");

		expect(first.ciphertext).not.toBe(second.ciphertext);
		expect(decryptSecret(ring, ROW, second.ciphertext, 1)).toBe("same");
	});

	it("fails with a wrong key", () => {
		const { ciphertext } = encryptSecret(ring, ROW, "value");
		const otherRing = parseSecretKeyRing(`v1:${OTHER_KEY}`);

		expect(() => decryptSecret(otherRing, ROW, ciphertext, 1)).toThrow(
			"project-1:STRIPE_SECRET_KEY failed to decrypt with v1",
		);
	});

	it("fails when the ciphertext moves to another row (AAD mismatch)", () => {
		const { ciphertext } = encryptSecret(ring, ROW, "value");

		expect(() =>
			decryptSecret(ring, { ...ROW, projectId: "project-2" }, ciphertext, 1),
		).toThrow("failed to decrypt");
		expect(() =>
			decryptSecret(ring, { ...ROW, name: "OTHER_NAME" }, ciphertext, 1),
		).toThrow("failed to decrypt");
	});

	it("fails on a changed byte and on a too-short ciphertext", () => {
		const { ciphertext } = encryptSecret(ring, ROW, "value");
		const bytes = Buffer.from(ciphertext, "base64");
		// SAFETY: the buffer holds at least the 28-byte IV and tag plus the data.
		bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 0xff;

		expect(() => decryptSecret(ring, ROW, bytes.toString("base64"), 1)).toThrow(
			"failed to decrypt",
		);
		expect(() => decryptSecret(ring, ROW, "AAAA", 1)).toThrow(
			"shorter than an IV and a tag",
		);
	});

	it("decrypts an older version and writes with the newest", () => {
		const oldRow = encryptSecret(ring, ROW, "old-value");
		const rotatedRing = parseSecretKeyRing(`v1:${KEY_V1},v2:${KEY_V2}`);

		expect(decryptSecret(rotatedRing, ROW, oldRow.ciphertext, 1)).toBe(
			"old-value",
		);
		const newRow = encryptSecret(rotatedRing, ROW, "new-value");
		expect(newRow.keyVersion).toBe(2);
	});

	it("re-encrypts a row so that the old version is no longer needed", () => {
		const oldRow = encryptSecret(ring, ROW, "value");
		const rotatedRing = parseSecretKeyRing(`v1:${KEY_V1},v2:${KEY_V2}`);
		const plaintext = decryptSecret(rotatedRing, ROW, oldRow.ciphertext, 1);
		const rotated = encryptSecret(rotatedRing, ROW, plaintext);
		const v2OnlyRing = parseSecretKeyRing(`v2:${KEY_V2}`);

		expect(rotated.keyVersion).toBe(2);
		expect(decryptSecret(v2OnlyRing, ROW, rotated.ciphertext, 2)).toBe("value");
		expect(() => decryptSecret(v2OnlyRing, ROW, oldRow.ciphertext, 1)).toThrow(
			"has no v1",
		);
	});
});
