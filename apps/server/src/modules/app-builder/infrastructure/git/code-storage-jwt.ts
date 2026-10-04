/**
 * Mints the ES256 JWTs that code.storage accepts.
 * `CodeStorageGitStore` signs API calls (`repo:write`) and the per-project
 * git credentials (`git:read`, `git:write`) with the org's PKCS8 private
 * key. No code.storage call is needed to mint: the JWT is the credential.
 */
import { importPKCS8, SignJWT } from "jose";

/**
 * The scopes a code.storage JWT may carry. One scope never includes
 * another, so a push credential carries `git:read` and `git:write` both.
 */
export type CodeStorageScope =
	| "git:read"
	| "git:write"
	| "repo:write"
	| "org:read";

/**
 * One rule of the `refs` claim: a ref pattern (`refs/heads/main`,
 * `refs/tags/*`, or `*`) and the ops code.storage refuses on it.
 * "no-force-push" refuses a non-fast-forward move of an existing ref. It
 * allows a create and a delete. "no-push" refuses every update of the ref.
 */
export type CodeStorageRefRule = [
	pattern: string,
	ops: ("no-force-push" | "no-push")[],
];

/** Input of `mintCodeStorageJwt`. */
export type MintCodeStorageJwtInput = {
	/** Org slug; becomes the `iss` claim and derives API and git hosts. */
	org: string;
	/**
	 * PKCS8 PEM of the org's ECDSA P-256 key, with real newlines. The env
	 * schema (`@wandit/env/code-storage-key`) normalizes and checks it at boot.
	 */
	privateKeyPem: string;
	/** Repository name the token is scoped to, for example `wandit/<id>`. */
	repoName: string;
	scopes: CodeStorageScope[];
	/**
	 * The `refs` claim, in order: the first matching rule wins. Unset means
	 * no ref policy, so a `git:write` token may force-push any ref.
	 */
	refs?: CodeStorageRefRule[];
	/** Lifetime of the token in seconds, counted from `now`. */
	ttlSeconds: number;
	/** Signing time; defaults to the current time. Specs pass a fixed date. */
	now?: Date;
};

/**
 * Signs one JWT: header `{ alg: "ES256", typ: "JWT" }`, claims `iss`,
 * `sub: "wandit-api"`, `repo`, `scopes`, `refs` when set, `iat`, `exp`.
 * `iat` is floored to whole seconds because JWT claims are seconds.
 */
export async function mintCodeStorageJwt(
	input: MintCodeStorageJwtInput,
): Promise<string> {
	const key = await importPKCS8(input.privateKeyPem, "ES256");
	const issuedAtSeconds = Math.floor(
		(input.now ?? new Date()).getTime() / 1000,
	);

	return new SignJWT({
		repo: input.repoName,
		scopes: input.scopes,
		refs: input.refs,
	})
		.setProtectedHeader({ alg: "ES256", typ: "JWT" })
		.setIssuer(input.org)
		.setSubject("wandit-api")
		.setIssuedAt(issuedAtSeconds)
		.setExpirationTime(issuedAtSeconds + input.ttlSeconds)
		.sign(key);
}
