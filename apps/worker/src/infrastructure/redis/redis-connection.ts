// Converts REDIS_URL into options for ioredis/BullMQ.
//
// The worker uses Redis for two things:
// - BullMQ jobs
// - publishing chat stream events
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

// Extra options each Redis caller can choose.
interface CreateRedisConnectionOptionsInput {
	commandTimeout?: number;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: number | null;
}

// Parse a Redis URL into the object shape ioredis expects.
export function createRedisConnectionOptions(
	redisUrl: string,
	options: CreateRedisConnectionOptionsInput = {},
): RedisConnectionOptions {
	const url = new URL(redisUrl);

	// ioredis wants host/port/auth as separate fields.
	return {
		commandTimeout: options.commandTimeout,
		host: url.hostname,
		lazyConnect: options.lazyConnect,
		maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
		password: url.password || undefined,
		port: Number(url.port || 6379),
		tls: url.protocol === "rediss:" ? {} : undefined,
		username: url.username || undefined,
	};
}
