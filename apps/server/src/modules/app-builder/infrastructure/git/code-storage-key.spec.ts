import { generateKeyPairSync } from "node:crypto";

import { codeStoragePrivateKeySchema } from "@wandit/env/code-storage-key";
import { describe, expect, it } from "vitest";

const p256 = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
const realPem = p256.export({ format: "pem", type: "pkcs8" }).toString();
const sec1Pem = p256.export({ format: "pem", type: "sec1" }).toString();
const p384Pem = generateKeyPairSync("ec", { namedCurve: "P-384" })
	.privateKey.export({ format: "pem", type: "pkcs8" })
	.toString();

describe("codeStoragePrivateKeySchema", () => {
	// `expected` null means the boot must stop with an error.
	it.each([
		{ name: "a real PEM", value: realPem, expected: realPem },
		{
			name: "a one-line PEM with \\n escapes",
			value: realPem.trim().replaceAll("\n", "\\n"),
			expected: realPem,
		},
		{
			// WANDIT-171: dotenv reads only the first line of an unquoted value.
			name: "the first line of the PEM only",
			value: realPem.split("\n")[0],
			expected: null,
		},
		{ name: "a SEC1 EC PRIVATE KEY", value: sec1Pem, expected: null },
		{ name: "a P-384 key", value: p384Pem, expected: null },
		{
			// Both PEM lines exist, so only the key parse can refuse it.
			name: "a PEM with a cut body",
			value: `${realPem.slice(0, 60)}\n-----END PRIVATE KEY-----`,
			expected: null,
		},
	])("$name", ({ value, expected }) => {
		const result = codeStoragePrivateKeySchema.safeParse(value);

		if (expected !== null) {
			expect(result.data).toBe(expected);
			return;
		}
		expect(result.success).toBe(false);
		const issues = JSON.stringify(result.error?.issues);
		expect(issues).toContain("CODE_STORAGE_PRIVATE_KEY");
		// The boot log prints the issues: no key body may be in them.
		expect(issues).not.toMatch(/[A-Za-z0-9+/]{40,}/);
	});
});
