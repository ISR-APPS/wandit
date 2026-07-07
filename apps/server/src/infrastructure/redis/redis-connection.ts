/**
 * Converts `REDIS_URL` into options for ioredis/BullMQ.
 *
 * Many files need Redis. This helper keeps URL parsing in one place.
 */
// Only the Redis options used by this project are listed here.
export interface RedisConnectionOptions {
	commandTimeout?: number;
	host: string;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: number | null;
	password?: string;
	port: number;
	tls?: Record<string, never>;
	username?: string;
}

// Extra options each caller can choose.
interface CreateRedisConnectionOptionsInput {
	commandTimeout?: number;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: number | null;
}

// Turn `redis://...` or `rediss://...` into the object shape ioredis expects.
export function createRedisConnectionOptions(
	redisUrl: string,
	options: CreateRedisConnectionOptionsInput = {},
): RedisConnectionOptions {
	// Use the built-in URL parser instead of splitting the string manually.
	const url = new URL(redisUrl);

	// ioredis wants host/port/password as separate fields.
	return {
		commandTimeout: options.commandTimeout,
		host: url.hostname,
		lazyConnect: options.lazyConnect,
		// If the caller does not choose a retry limit, use `null`, which is common
		// for BullMQ/ioredis blocking commands.
		maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
		password: url.password || undefined,
		port: Number(url.port || 6379),
		// `rediss://` means Redis over TLS.
		tls: url.protocol === "rediss:" ? {} : undefined,
		username: url.username || undefined,
	};
}
