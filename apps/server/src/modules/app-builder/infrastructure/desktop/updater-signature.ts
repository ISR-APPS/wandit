/**
 * Ed25519 updater keys and minisign signatures of desktop installers
 * (docs/v2/desktop-apps.md section 10). tauri-plugin-updater 2.x checks
 * these signatures with the `minisign-verify` crate. `DesktopBuildsService`
 * makes the key pair of a new app; the `desktop-build` task signs and checks
 * each installer. It calls node:crypto and `secret-crypto.ts`.
 */
import {
	createHash,
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	type KeyObject,
	randomBytes,
	sign,
	verify,
} from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import {
	decryptSecret,
	type EncryptedSecret,
	encryptSecret,
	type SecretKeyRing,
	type SecretRowIdentity,
} from "../secrets/secret-crypto";

// The secret name in the AAD `<project id>:DESKTOP_UPDATER_KEY` of the encrypted private key.
const DESKTOP_UPDATER_KEY_SECRET_NAME = "DESKTOP_UPDATER_KEY";

/** A new updater key pair. Only `privateKeyPkcs8` is secret. */
export type UpdaterKeyPair = {
	/** 16 uppercase hex digits: the little-endian u64 of the 8 key id bytes, as minisign prints it. */
	keyId: string;
	/** Base64 of the 2-line minisign public key text. The `plugins.updater.pubkey` value. */
	publicKey: string;
	/** Base64 of the PKCS8 DER Ed25519 private key. Store it only encrypted. */
	privateKeyPkcs8: string;
};

/** Input of `signUpdaterArtifact`. */
export type SignUpdaterArtifactInput = {
	/** Base64 PKCS8 DER, from `decryptDesktopUpdaterKey`. */
	privateKeyPkcs8: string;
	/** `desktop_apps.updater_key_id`. */
	keyId: string;
	/** Local path of the installer. The file is streamed, never read whole. */
	filePath: string;
	/** File name in the trusted comment, for example `stock-1.0.3-setup.exe`. */
	fileName: string;
	/** Semver of the build. tauri-plugin-updater compares it with the manifest version. */
	version: string;
	/** Signing time in Unix seconds. */
	timestamp: number;
};

/** Input of `verifyUpdaterSignature`. */
export type VerifyUpdaterSignatureInput = {
	/** `desktop_apps.updater_public_key`. */
	publicKey: string;
	/** Local path of the installer. */
	filePath: string;
	/** Base64 of the 4-line signature text, as `signUpdaterArtifact` answers it. */
	signature: string;
	/** The version that the trusted comment must name. */
	version: string;
};

// minisign algorithm tags: "Ed" names the key; "ED" names a signature of
// the BLAKE2b-512 digest of the file.
const KEY_ALGORITHM = "Ed";
const PREHASHED_ALGORITHM = "ED";
const KEY_ID_BYTES = 8;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
const KEY_ID_PATTERN = /^[0-9A-F]{16}$/;
const TRUSTED_COMMENT_PREFIX = "trusted comment: ";
// The text that `tauri signer sign` writes on line 1. No check reads it.
const SIGNATURE_UNTRUSTED_COMMENT =
	"untrusted comment: signature from tauri secret key";

/** Makes a new Ed25519 key pair with a random 8-byte key id. */
export function generateUpdaterKeyPair(): UpdaterKeyPair {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const keyIdBytes = randomBytes(KEY_ID_BYTES);
	// minisign prints the key id as a little-endian u64, so the hex digits
	// are the bytes in reverse order.
	const keyId = Buffer.from(keyIdBytes).reverse().toString("hex").toUpperCase();
	const publicKeyBytes = rawPublicKey(publicKey);
	const keyLine = Buffer.concat([
		Buffer.from(KEY_ALGORITHM, "ascii"),
		keyIdBytes,
		publicKeyBytes,
	]).toString("base64");
	const publicKeyText = `untrusted comment: minisign public key: ${keyId}\n${keyLine}\n`;
	return {
		keyId,
		privateKeyPkcs8: privateKey
			.export({ format: "der", type: "pkcs8" })
			.toString("base64"),
		publicKey: Buffer.from(publicKeyText, "utf8").toString("base64"),
	};
}

/**
 * Signs one installer in the minisign `ED` form and answers the base64 of
 * the 4-line signature text: the `signature` of the updater manifest.
 */
export async function signUpdaterArtifact(
	input: SignUpdaterArtifactInput,
): Promise<string> {
	// A tab or a line break would add a field or a line to the trusted comment.
	if (/[\t\r\n]/.test(`${input.fileName}${input.version}`)) {
		throw new Error(
			"The file name and the version must not hold a tab or a line break",
		);
	}
	const privateKey = createPrivateKey({
		format: "der",
		key: Buffer.from(input.privateKeyPkcs8, "base64"),
		type: "pkcs8",
	});
	const digest = await blake2b512OfFile(input.filePath);
	const fileSignature = sign(null, digest, privateKey);
	const trustedComment = `timestamp:${input.timestamp}\tfile:${input.fileName}\tversion:${input.version}`;
	const globalSignature = sign(
		null,
		Buffer.concat([fileSignature, Buffer.from(trustedComment, "utf8")]),
		privateKey,
	);
	const signatureLine = Buffer.concat([
		Buffer.from(PREHASHED_ALGORITHM, "ascii"),
		keyIdToBytes(input.keyId),
		fileSignature,
	]).toString("base64");
	const text = `${SIGNATURE_UNTRUSTED_COMMENT}\n${signatureLine}\n${TRUSTED_COMMENT_PREFIX}${trustedComment}\n${globalSignature.toString("base64")}\n`;
	return Buffer.from(text, "utf8").toString("base64");
}

/**
 * Checks a signature the way tauri-plugin-updater does, plus the version.
 * Answers false for a wrong key id or algorithm, a changed file, a changed
 * comment, another version, and any malformed input.
 */
export async function verifyUpdaterSignature(
	input: VerifyUpdaterSignatureInput,
): Promise<boolean> {
	const publicKey = parsePublicKey(input.publicKey);
	const signature = parseSignature(input.signature);
	if (
		publicKey === null ||
		signature === null ||
		!signature.keyId.equals(publicKey.keyId)
	) {
		return false;
	}
	const digest = await blake2b512OfFile(input.filePath);
	const isFileSigned = verify(
		null,
		digest,
		publicKey.key,
		signature.fileSignature,
	);
	const isCommentSigned = verify(
		null,
		Buffer.concat([
			signature.fileSignature,
			Buffer.from(signature.trustedComment, "utf8"),
		]),
		publicKey.key,
		signature.globalSignature,
	);
	const signedVersion = signature.trustedComment
		.split("\t")
		.find((field) => field.startsWith("version:"))
		?.slice("version:".length);
	return isFileSigned && isCommentSigned && signedVersion === input.version;
}

/** Encrypts the private key of one app with the current ring version. */
export function encryptDesktopUpdaterKey(
	ring: SecretKeyRing,
	projectId: string,
	privateKeyPkcs8: string,
): EncryptedSecret {
	return encryptSecret(ring, updaterKeyIdentity(projectId), privateKeyPkcs8);
}

/**
 * Decrypts the private key of one `desktop_apps` row for the
 * `desktop-build` task. Throws when the ring lacks the version or the
 * ciphertext belongs to another project.
 */
export function decryptDesktopUpdaterKey(
	ring: SecretKeyRing,
	app: {
		projectId: string;
		/** `desktop_apps.updater_private_key_ciphertext`. */
		updaterPrivateKeyCiphertext: string;
		/** `desktop_apps.updater_key_version`. */
		updaterKeyVersion: number;
	},
): string {
	return decryptSecret(
		ring,
		updaterKeyIdentity(app.projectId),
		app.updaterPrivateKeyCiphertext,
		app.updaterKeyVersion,
	);
}

/** The AAD identity of the private key: `<project id>:DESKTOP_UPDATER_KEY` (section 8, step 5). */
export function updaterKeyIdentity(projectId: string): SecretRowIdentity {
	return { name: DESKTOP_UPDATER_KEY_SECRET_NAME, projectId };
}

async function blake2b512OfFile(filePath: string): Promise<Buffer> {
	const hash = createHash("blake2b512");
	await pipeline(createReadStream(filePath), hash);
	return hash.digest();
}

function rawPublicKey(key: KeyObject): Buffer {
	const jwk = key.export({ format: "jwk" });
	if (jwk.x === undefined) {
		throw new Error("The Ed25519 public key has no x value");
	}
	return Buffer.from(jwk.x, "base64url");
}

function keyIdToBytes(keyId: string): Buffer {
	if (!KEY_ID_PATTERN.test(keyId)) {
		throw new Error("The updater key id must be 16 uppercase hex digits");
	}
	return Buffer.from(keyId, "hex").reverse();
}

// The lines of a base64 minisign text. The last line break is optional.
function decodedLines(base64Text: string): string[] {
	const lines = Buffer.from(base64Text, "base64").toString("utf8").split("\n");
	return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

function parsePublicKey(
	base64Text: string,
): { keyId: Buffer; key: KeyObject } | null {
	const lines = decodedLines(base64Text);
	const bytes = Buffer.from(lines[1] ?? "", "base64");
	if (
		lines.length !== 2 ||
		bytes.length !== 2 + KEY_ID_BYTES + ED25519_PUBLIC_KEY_BYTES ||
		bytes.subarray(0, 2).toString("ascii") !== KEY_ALGORITHM
	) {
		return null;
	}
	return {
		key: createPublicKey({
			format: "jwk",
			key: {
				crv: "Ed25519",
				kty: "OKP",
				x: bytes.subarray(2 + KEY_ID_BYTES).toString("base64url"),
			},
		}),
		keyId: bytes.subarray(2, 2 + KEY_ID_BYTES),
	};
}

function parseSignature(base64Text: string): {
	keyId: Buffer;
	fileSignature: Buffer;
	trustedComment: string;
	globalSignature: Buffer;
} | null {
	const lines = decodedLines(base64Text);
	const bytes = Buffer.from(lines[1] ?? "", "base64");
	const commentLine = lines[2] ?? "";
	const globalSignature = Buffer.from(lines[3] ?? "", "base64");
	if (
		lines.length !== 4 ||
		bytes.length !== 2 + KEY_ID_BYTES + ED25519_SIGNATURE_BYTES ||
		bytes.subarray(0, 2).toString("ascii") !== PREHASHED_ALGORITHM ||
		!commentLine.startsWith(TRUSTED_COMMENT_PREFIX) ||
		globalSignature.length !== ED25519_SIGNATURE_BYTES
	) {
		return null;
	}
	return {
		fileSignature: bytes.subarray(2 + KEY_ID_BYTES),
		globalSignature,
		keyId: bytes.subarray(2, 2 + KEY_ID_BYTES),
		trustedComment: commentLine.slice(TRUSTED_COMMENT_PREFIX.length),
	};
}
