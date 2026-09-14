/**
 * Call-time checks for the optional V2 environment values.
 * The V2 health controller and later V2 providers call these helpers.
 * Every V2 value stays optional at boot; a missing value is an error only
 * when a caller asks for it.
 */
import { ServiceUnavailableException } from "@nestjs/common";
import { type V2EnvName, v2EnvNames } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { V2Harness } from "@wandit/env/v2-harness";

/** The contract list of V2 env names, re-exported for server callers. */
export const V2_ENV_NAMES = v2EnvNames;

/**
 * The slice of `env` the V2 code reads. Specs pass a plain subset object;
 * production callers get the real validated `env` through the default.
 */
export type V2EnvSource = Readonly<
	Partial<Record<V2EnvName, string | undefined>> & {
		V2_HARNESS: V2Harness;
	}
>;

/**
 * Nest token that carries the validated `env` into V2 classes. The module
 * provides it with `useValue: env`; specs inject a plain object instead.
 */
export const V2_ENV = Symbol.for("app-builder.v2-env");

/**
 * Returns one V2 env value or throws a 503 when it is unset. Call at the
 * point of use, never at module load.
 */
export function requireV2Env(
	name: V2EnvName,
	source: V2EnvSource = env,
): string {
	const value = source[name];
	if (value === undefined) {
		throw new ServiceUnavailableException({
			code: "V2_ENV_MISSING",
			message: `${name} is not set`,
		});
	}
	return value;
}

/**
 * Set/not-set booleans for every V2 env name. Feeds the health route;
 * never returns a value.
 */
export function v2EnvPresence(
	source: V2EnvSource = env,
): Record<V2EnvName, boolean> {
	// SAFETY: the loop below assigns every V2EnvName key.
	const presence = {} as Record<V2EnvName, boolean>;
	for (const name of v2EnvNames) {
		presence[name] = source[name] !== undefined;
	}
	return presence;
}
