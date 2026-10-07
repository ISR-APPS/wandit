/**
 * Port: the lock that allows one open Appetize device session per user
 * (WANDIT-196). `DeviceSessionsService` takes it at start and frees it at
 * end; the Redis key expires after the time limit, so a closed tab frees it.
 */

/** Nest token for the `DeviceSessionLock` implementation. */
export const DEVICE_SESSION_LOCK = Symbol.for(
	"app-builder.device-session-lock",
);

/** One lock per user; the stored value is the `device_sessions.id` that holds it. */
export interface DeviceSessionLock {
	/** `SET mobile_preview:user:{userId} deviceSessionId NX PX ttlMs`. False when held. */
	acquire(
		userId: string,
		deviceSessionId: string,
		ttlMs: number,
	): Promise<boolean>;
	/** Compare-and-delete: removes the key only for the holding session. */
	release(userId: string, deviceSessionId: string): Promise<boolean>;
}
