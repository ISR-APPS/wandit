import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
	generateUpdaterKeyPair,
	signElectronUpdate,
	signUpdaterArtifact,
	verifyElectronUpdateSignature,
	verifyUpdaterSignature,
} from "./updater-signature";

// Made by `signUpdaterArtifact` and accepted by the Rust crate
// minisign-verify 0.3.0 with the code path of tauri-plugin-updater 2.14.1
// (`verify_signature`: base64 decode, `PublicKey::decode`,
// `Signature::decode`, `verify(data, signature, true)`, signed version).
const FIXTURE = {
	bytes: "MZ wandit desktop fixture\n",
	publicKey:
		"dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFDNEQ3MDcyMDdBMTE4QzIKUldUQ0dLRUhjbkJOckdaVE1rVllXM3hoaXBrYXg3bWhVZHROVUNUOGZSYy9uemIxZG9wbUU4OW0K",
	signature:
		"dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUQ0dLRUhjbkJOckFzeEZqNzVNM1haRlFJWm5BblBmUUxjUVRpN2RjRlEwSzZhRVRiZGc0dGRoRGFURHFBWDZRT3JOMlNhbldxWFJUenJSTWxnTnRKOW5ad1h0UXIyK0E0PQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwMDAwMDAwCWZpbGU6c3RvY2stMS4wLjMtc2V0dXAuZXhlCXZlcnNpb246MS4wLjMKWGhUMUxHditZakVoRVNWcDRCMElYaEVhem94S25EUnVOcG1kS2tEVFR1L0U4MXF2V1dkQnJPUkxHVGZUeXliTWtIeU9OaXJoZW1DVU85MG10SzkrRFE9PQo=",
	version: "1.0.3",
};

// The fixture public key with one other key id byte. Same Ed25519 key.
function publicKeyWithOtherKeyId(): string {
	const [comment, keyLine] = Buffer.from(FIXTURE.publicKey, "base64")
		.toString("utf8")
		.split("\n");
	const bytes = Buffer.from(keyLine ?? "", "base64");
	bytes[2] = (bytes[2] ?? 0) ^ 1;
	return Buffer.from(
		`${comment}\n${bytes.toString("base64")}\n`,
		"utf8",
	).toString("base64");
}

const dir = join(tmpdir(), `updater-signature-${randomUUID()}`);
const installer = join(dir, "installer.bin");
const changedInstaller = join(dir, "changed.bin");

beforeAll(async () => {
	await mkdir(dir, { recursive: true });
	await writeFile(installer, FIXTURE.bytes);
	await writeFile(changedInstaller, FIXTURE.bytes.replace("w", "W"));
});

afterAll(async () => {
	await rm(dir, { force: true, recursive: true });
});

describe("verifyUpdaterSignature", () => {
	it("accepts the signature that minisign-verify accepted", async () => {
		await expect(
			verifyUpdaterSignature({
				filePath: installer,
				publicKey: FIXTURE.publicKey,
				signature: FIXTURE.signature,
				version: FIXTURE.version,
			}),
		).resolves.toBe(true);
	});

	it.each([
		{
			filePath: changedInstaller,
			name: "a changed byte",
			publicKey: FIXTURE.publicKey,
			version: FIXTURE.version,
		},
		{
			filePath: installer,
			name: "a wrong key id",
			publicKey: publicKeyWithOtherKeyId(),
			version: FIXTURE.version,
		},
		{
			filePath: installer,
			name: "another version",
			publicKey: FIXTURE.publicKey,
			version: "1.0.4",
		},
	])("refuses $name", async ({ filePath, publicKey, version }) => {
		await expect(
			verifyUpdaterSignature({
				filePath,
				publicKey,
				signature: FIXTURE.signature,
				version,
			}),
		).resolves.toBe(false);
	});
});

describe("signUpdaterArtifact", () => {
	it("signs with a new key pair so that only that public key verifies", async () => {
		const keys = generateUpdaterKeyPair();
		const signature = await signUpdaterArtifact({
			fileName: "stock-1.0.7-setup.exe",
			filePath: installer,
			keyId: keys.keyId,
			privateKeyPkcs8: keys.privateKeyPkcs8,
			timestamp: 1_790_000_000,
			version: "1.0.7",
		});

		expect(keys.keyId).toMatch(/^[0-9A-F]{16}$/);
		await expect(
			verifyUpdaterSignature({
				filePath: installer,
				publicKey: keys.publicKey,
				signature,
				version: "1.0.7",
			}),
		).resolves.toBe(true);
		await expect(
			verifyUpdaterSignature({
				filePath: installer,
				publicKey: FIXTURE.publicKey,
				signature,
				version: "1.0.7",
			}),
		).resolves.toBe(false);
	});
});

describe("signElectronUpdate", () => {
	// The Electron shell has its own verify code. This case builds the
	// message and reads the key as the shell does, without the server helpers.
	it("signs the wandit-ed25519-v1 message for the raw key inside the minisign public key", async () => {
		const keys = generateUpdaterKeyPair();
		const signature = await signElectronUpdate({
			filePath: installer,
			privateKeyPkcs8: keys.privateKeyPkcs8,
			version: "1.0.7",
		});

		const keyLine =
			Buffer.from(keys.publicKey, "base64").toString("utf8").split("\n")[1] ??
			"";
		// Bytes 10 to 42: after "Ed" and the 8-byte key id.
		const rawKey = Buffer.from(keyLine, "base64").subarray(10, 42);
		const fileHash = createHash("sha512").update(FIXTURE.bytes).digest("hex");
		const signatureBytes = Buffer.from(signature, "base64");
		expect(signatureBytes).toHaveLength(64);
		expect(
			verify(
				null,
				Buffer.from(`wandit-desktop-update-v1\n1.0.7\n${fileHash}\n`, "utf8"),
				createPublicKey({
					format: "jwk",
					key: { crv: "Ed25519", kty: "OKP", x: rawKey.toString("base64url") },
				}),
				signatureBytes,
			),
		).toBe(true);
	});
});

describe("verifyElectronUpdateSignature", () => {
	const keys = generateUpdaterKeyPair();
	const signed = () =>
		signElectronUpdate({
			filePath: installer,
			privateKeyPkcs8: keys.privateKeyPkcs8,
			version: "1.0.7",
		});

	it.each([
		{
			expected: true,
			filePath: installer,
			name: "accepts the signed file and version",
			publicKey: keys.publicKey,
			version: "1.0.7",
		},
		// An older signed file must not pass as a newer version.
		{
			expected: false,
			filePath: installer,
			name: "refuses another version",
			publicKey: keys.publicKey,
			version: "1.0.8",
		},
		{
			expected: false,
			filePath: changedInstaller,
			name: "refuses a changed byte",
			publicKey: keys.publicKey,
			version: "1.0.7",
		},
		{
			expected: false,
			filePath: installer,
			name: "refuses the key of another app",
			publicKey: FIXTURE.publicKey,
			version: "1.0.7",
		},
	])("$name", async ({ expected, filePath, publicKey, version }) => {
		await expect(
			verifyElectronUpdateSignature({
				filePath,
				publicKey,
				signature: await signed(),
				version,
			}),
		).resolves.toBe(expected);
	});

	// A minisign signature of the Tauri engine must not pass as an Electron signature.
	it("refuses a signature that is not 64 bytes", async () => {
		await expect(
			verifyElectronUpdateSignature({
				filePath: installer,
				publicKey: FIXTURE.publicKey,
				signature: FIXTURE.signature,
				version: FIXTURE.version,
			}),
		).resolves.toBe(false);
	});
});
