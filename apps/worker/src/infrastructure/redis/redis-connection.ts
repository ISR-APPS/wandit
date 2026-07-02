export interface RedisConnectionOptions {
	host: string;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: null;
	password?: string;
	port: number;
	tls?: Record<string, never>;
	username?: string;
}

export function createRedisConnectionOptions(
	redisUrl: string,
): RedisConnectionOptions {
	const url = new URL(redisUrl);

	return {
		host: url.hostname,
		maxRetriesPerRequest: null,
		password: url.password || undefined,
		port: Number(url.port || 6379),
		tls: url.protocol === "rediss:" ? {} : undefined,
		username: url.username || undefined,
	};
}
