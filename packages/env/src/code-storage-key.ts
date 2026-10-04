/**
 * Zod schema of CODE_STORAGE_PRIVATE_KEY, the key that signs code.storage JWTs.
 * The server env schema (server.ts) uses it, so a bad key stops the boot.
 * The JWT code in the server then trusts the value. It uses zod and node:crypto.
 */
import { createPrivateKey, type KeyObject } from "node:crypto";
import { z } from "zod";

const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";

/**
 * Accepts an unencrypted PKCS8 PEM of an EC P-256 key (the ES256 key) and
 * returns it with real newlines and one final newline. Literal `\n` escapes
 * become newlines. An error names the variable and the cause, never the value.
 */
export const codeStoragePrivateKeySchema = z
	.string()
	.transform((value, context) => {
		// A one-line env value stores the newlines as `\n` escapes.
		const pem = (
			value.includes("\n") ? value : value.replaceAll("\\n", "\n")
		).trim();
		const problem = pemProblem(pem);
		if (problem !== null) {
			context.addIssue({
				code: "custom",
				message: `CODE_STORAGE_PRIVATE_KEY ${problem}`,
			});
			return z.NEVER;
		}
		return `${pem}\n`;
	});

// The reason why the PEM cannot sign ES256 JWTs, or null when it can.
function pemProblem(pem: string): string | null {
	if (!pem.startsWith(PEM_BEGIN)) {
		return 'must be an unencrypted PKCS8 PEM ("BEGIN PRIVATE KEY"). Convert other formats with "openssl pkcs8 -topk8 -nocrypt".';
	}
	// WANDIT-171: dotenv reads only the first line of an unquoted multi-line value.
	if (!pem.endsWith(PEM_END)) {
		return 'has no "END PRIVATE KEY" line, so only a part of the PEM was read. Quote the multi-line value or use \\n escapes.';
	}
	let key: KeyObject;
	try {
		key = createPrivateKey({ key: pem, format: "pem" });
	} catch {
		// node:crypto refuses a cut or damaged body. Its message is not needed.
		return "does not parse as a private key. The PEM body is cut or damaged.";
	}
	// ES256 signs with P-256 only. node:crypto names that curve "prime256v1".
	if (
		key.asymmetricKeyType !== "ec" ||
		key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
	) {
		return "must be an EC P-256 key, because code.storage JWTs use ES256.";
	}
	return null;
}
