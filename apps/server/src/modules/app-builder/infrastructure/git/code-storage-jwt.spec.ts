import { generateKeyPairSync } from "node:crypto";

import { importSPKI, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { mintCodeStorageJwt } from "./code-storage-jwt";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "P-256",
});
const privateKeyPem = privateKey
	.export({ format: "pem", type: "pkcs8" })
	.toString();
const publicKeyPem = publicKey
	.export({ format: "pem", type: "spki" })
	.toString();

describe("mintCodeStorageJwt", () => {
	it("signs an ES256 token with the org, repo, scopes, and expiry claims", async () => {
		const token = await mintCodeStorageJwt({
			org: "wandit",
			privateKeyPem,
			repoName: "wandit/project-1",
			scopes: ["git:read", "git:write"],
			ttlSeconds: 600,
			now: new Date("2026-09-14T10:00:00.500Z"),
		});

		const key = await importSPKI(publicKeyPem, "ES256");
		// The token was signed at a fixed `now`; verify it inside its
		// validity window instead of the wall clock.
		const { payload, protectedHeader } = await jwtVerify(token, key, {
			currentDate: new Date("2026-09-14T10:05:00Z"),
		});

		expect(protectedHeader.alg).toBe("ES256");
		expect(protectedHeader.typ).toBe("JWT");
		expect(payload.iss).toBe("wandit");
		expect(payload.sub).toBe("wandit-api");
		expect(payload.repo).toBe("wandit/project-1");
		expect(payload.scopes).toEqual(["git:read", "git:write"]);
		expect(payload.iat).toBe(
			Math.floor(Date.parse("2026-09-14T10:00:00.500Z") / 1000),
		);
		expect(payload.exp).toBe((payload.iat ?? 0) + 600);
	});

	it("accepts a PEM that stores newlines as \\n escapes", async () => {
		const escaped = privateKeyPem.replaceAll("\n", "\\n");

		const token = await mintCodeStorageJwt({
			org: "wandit",
			privateKeyPem: escaped,
			repoName: "wandit/project-1",
			scopes: ["repo:write"],
			ttlSeconds: 300,
			now: new Date("2026-09-14T10:00:00Z"),
		});

		const key = await importSPKI(publicKeyPem, "ES256");
		// Same fixed `now` reason as above: pin verification time.
		const { payload } = await jwtVerify(token, key, {
			currentDate: new Date("2026-09-14T10:01:00Z"),
		});

		expect(payload.scopes).toEqual(["repo:write"]);
	});

	it("fails verification with a different key", async () => {
		const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
		const token = await mintCodeStorageJwt({
			org: "wandit",
			privateKeyPem,
			repoName: "wandit/project-1",
			scopes: ["git:read"],
			ttlSeconds: 60,
		});

		const otherPublicPem = other.publicKey
			.export({ format: "pem", type: "spki" })
			.toString();
		const otherKey = await importSPKI(otherPublicPem, "ES256");

		await expect(jwtVerify(token, otherKey)).rejects.toThrow();
	});
});
