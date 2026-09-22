/**
 * AES-256-GCM encryption of one project secret value (WANDIT-185).
 * `ProjectSecretsService` and `rotateProjectSecrets` call it. The key
 * ring comes from `APP_SECRETS_ENCRYPTION_KEY`; the caller parses it at
 * call time with `parseSecretKeyRing`, so a missing key never breaks boot.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
/** AES-256 takes a 32-byte key. */
const KEY_BYTES = 32;
/** The GCM standard nonce size. A fresh random one per write. */
const IV_BYTES = 12;
/** The full GCM tag; a shorter tag weakens the integrity check. */
const AUTH_TAG_BYTES = 16;
/** One entry of the env value: `v<version>:<base64 key>`. */
const KEY_ENTRY_PATTERN = /^v(\d+):(.+)$/;

/** The parsed `APP_SECRETS_ENCRYPTION_KEY`. */
export type SecretKeyRing = {
	/** The highest listed version. Every new write encrypts with it. */
	currentVersion: number;
	/** Every listed key by version. All of them decrypt. */
	keys: ReadonlyMap<number, Buffer>;
};

/**
 * The row identity that binds a ciphertext to its row. The cipher checks
 * it on decrypt, so a ciphertext copied to another row fails.
 */
export type SecretRowIdentity = {
	projectId: string;
	name: string;
};

/** What `encryptSecret` answers; both fields land on the row. */
export type EncryptedSecret = {
	/** Base64 of the IV, the auth tag, and the encrypted bytes, in that order. */
	ciphertext: string;
	/** The ring version that encrypted the value. */
	keyVersion: number;
};

/**
 * Parses `v1:<base64 32 bytes>,v2:<base64 32 bytes>`. Throws on an empty
 * list, a malformed entry, a key that is not 32 bytes, or a repeated
 * version. The error names the entry, never the key bytes.
 */
export function parseSecretKeyRing(raw: string): SecretKeyRing {
	const keys = new Map<number, Buffer>();
	for (const entry of raw.split(",")) {
		const match = KEY_ENTRY_PATTERN.exec(entry.trim());
		if (match?.[1] === undefined || match[2] === undefined) {
			throw new Error(
				"APP_SECRETS_ENCRYPTION_KEY entry must look like v1:<base64>",
			);
		}
		const version = Number(match[1]);
		const key = Buffer.from(match[2], "base64");
		if (key.length !== KEY_BYTES) {
			throw new Error(
				`APP_SECRETS_ENCRYPTION_KEY v${version} must decode to ${KEY_BYTES} bytes`,
			);
		}
		if (keys.has(version)) {
			throw new Error(`APP_SECRETS_ENCRYPTION_KEY lists v${version} twice`);
		}
		keys.set(version, key);
	}
	const currentVersion = Math.max(...keys.keys());
	return { currentVersion, keys };
}

/** Encrypts one value with the current ring version under a fresh IV. */
export function encryptSecret(
	ring: SecretKeyRing,
	row: SecretRowIdentity,
	plaintext: string,
): EncryptedSecret {
	const key = ring.keys.get(ring.currentVersion);
	if (key === undefined) {
		throw new Error(
			`APP_SECRETS_ENCRYPTION_KEY has no v${ring.currentVersion}`,
		);
	}
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_BYTES,
	});
	cipher.setAAD(Buffer.from(additionalData(row), "utf8"));
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	return {
		ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
			"base64",
		),
		keyVersion: ring.currentVersion,
	};
}

/**
 * Decrypts one row value with the ring key of `keyVersion`. Throws when
 * the version is not in the ring, when the key is wrong, when the bytes
 * changed, or when the row identity differs from the one that encrypted.
 */
export function decryptSecret(
	ring: SecretKeyRing,
	row: SecretRowIdentity,
	ciphertext: string,
	keyVersion: number,
): string {
	const key = ring.keys.get(keyVersion);
	if (key === undefined) {
		throw new Error(
			`APP_SECRETS_ENCRYPTION_KEY has no v${keyVersion}; ${row.projectId}:${row.name} cannot decrypt`,
		);
	}
	const bytes = Buffer.from(ciphertext, "base64");
	if (bytes.length < IV_BYTES + AUTH_TAG_BYTES) {
		throw new Error(
			`Ciphertext of ${row.projectId}:${row.name} is shorter than an IV and a tag`,
		);
	}
	const decipher = createDecipheriv(
		ALGORITHM,
		key,
		bytes.subarray(0, IV_BYTES),
		{ authTagLength: AUTH_TAG_BYTES },
	);
	decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES));
	decipher.setAAD(Buffer.from(additionalData(row), "utf8"));
	try {
		return Buffer.concat([
			decipher.update(bytes.subarray(IV_BYTES + AUTH_TAG_BYTES)),
			decipher.final(),
		]).toString("utf8");
	} catch (error) {
		// Node answers one generic message for a wrong key, a changed byte, and
		// a wrong AAD; the row identity makes the failure findable.
		throw new Error(
			`Secret ${row.projectId}:${row.name} failed to decrypt with v${keyVersion}`,
			{ cause: error },
		);
	}
}

/** The AAD string: `projectId:name`. Both are stored next to the ciphertext. */
function additionalData(row: SecretRowIdentity): string {
	return `${row.projectId}:${row.name}`;
}
