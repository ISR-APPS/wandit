/**
 * Contracts of the Appetize device preview (WANDIT-196): the device-session
 * routes of the API, the Appetize and Expo answers that the server reads, and
 * the Appetize JS SDK events that the web reads. The API controller and the
 * web device panel use the route schemas. The server Appetize client and the
 * upload script parse the vendor answers.
 *
 * Covered vendor paths:
 * - GET  https://exp.host/--/api/v2/versions (the Expo Go builds of each SDK)
 * - POST https://api.appetize.io/v1/apps and /v1/apps/{publicKey}
 * - GET  https://api.appetize.io/v1/apps/{publicKey}
 * - GET  https://api.appetize.io/v2/sessions?sessionToken=
 */
import { z } from "zod";
import { uuidSchema } from "../v1/shared/primitives";

/** Platform of one device session. It picks the Expo Go build and the Appetize device. */
export const devicePlatformSchema = z.enum(["ios", "android"]);

/** TypeScript device platform. */
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

/** Body of `POST /api/v2/projects/:projectId/device-sessions`. */
export const startDeviceSessionRequestSchema = z.object({
	platform: devicePlatformSchema,
});

/** TypeScript start body. */
export type StartDeviceSessionRequest = z.infer<
	typeof startDeviceSessionRequestSchema
>;

/**
 * Launch params that Expo Go reads at start. Both skip the Expo Go
 * onboarding screens, the same values as Expo Snack.
 */
export const expoGoLaunchParamsSchema = z.object({
	EXDevMenuDisableAutoLaunch: z.literal(true),
	EXKernelDisableNuxDefaultsKey: z.literal(true),
});

/**
 * Answer of the start route: the Appetize client config of one device
 * session. The web panel passes it to `appetize.getClient`.
 */
export const startDeviceSessionResponseSchema = z.object({
	/** Id of the `device_sessions` row. The end route takes it. */
	deviceSessionId: uuidSchema,
	/** Appetize app id (the build id) of the Expo Go build for the platform. */
	publicKey: z.string().min(1),
	/** Appetize device id, for example `iphone15pro` or `pixel8`. */
	device: z.string().min(1),
	/** OS version of the Appetize device, for example `17.2`. */
	osVersion: z.string().min(1),
	/** `exps://` phone link of the project that Expo Go opens at launch. */
	launchUrl: z.string().startsWith("exps://"),
	params: expoGoLaunchParamsSchema,
	/** Session time limit in seconds. The web countdown starts from it. */
	timeLimitSeconds: z.int().positive(),
});

/** TypeScript start answer. */
export type StartDeviceSessionResponse = z.infer<
	typeof startDeviceSessionResponseSchema
>;

/**
 * Body of `POST .../device-sessions/:deviceSessionId/end`. The token is
 * absent when Appetize never started the session, for example after a
 * queue that the user left.
 */
export const endDeviceSessionRequestSchema = z.object({
	/** `session.token` of the Appetize JS SDK. The minutes task reads the session times with it. */
	appetizeSessionToken: z
		.string()
		.min(1)
		.max(200)
		.regex(/^[A-Za-z0-9_-]+$/)
		.optional(),
});

/** TypeScript end body. */
export type EndDeviceSessionRequest = z.infer<
	typeof endDeviceSessionRequestSchema
>;

/** Answer of the end route. A repeat end answers the same. */
export const endDeviceSessionResponseSchema = z.object({
	ended: z.literal(true),
});

/** Data of the `queue` event of the Appetize JS SDK: the place of the user in the device queue. */
export const appetizeQueueEventSchema = z.object({
	position: z.int().nonnegative(),
});

/** Data of the `inactivityWarning` event of an Appetize session. */
export const appetizeInactivityWarningSchema = z.object({
	secondsRemaining: z.number().nonnegative(),
});

/** One Expo Go release in the Expo versions answer. Old SDKs have no client URLs. */
const expoSdkVersionSchema = z.object({
	iosClientUrl: z.url().optional(),
	iosClientVersion: z.string().optional(),
	androidClientUrl: z.url().optional(),
	androidClientVersion: z.string().optional(),
});

/** Answer of `GET https://exp.host/--/api/v2/versions`, keyed by SDK version such as `57.0.0`. */
export const expoVersionsResponseSchema = z.object({
	sdkVersions: z.record(z.string(), expoSdkVersionSchema),
});

/** Answer of the Appetize v1 app routes. `note` holds the Expo Go version of the upload. */
export const appetizeAppSchema = z.object({
	publicKey: z.string().min(1),
	platform: devicePlatformSchema,
	versionCode: z.int().optional(),
	note: z.string().nullish(),
});

/** TypeScript Appetize app. */
export type AppetizeApp = z.infer<typeof appetizeAppSchema>;

/**
 * One session of `GET /v2/sessions`. The minutes task bills
 * `closeTime - startTime`; both stay null until Appetize closes the session.
 */
export const appetizeSessionLogSchema = z.object({
	sessionToken: z.string().min(1),
	// A vendor time can carry an offset instead of `Z`.
	startTime: z.iso.datetime({ offset: true }).nullable(),
	closeTime: z.iso.datetime({ offset: true }).nullable(),
});

/** Answer of `GET /v2/sessions`. */
export const appetizeSessionsResponseSchema = z.object({
	results: z.array(appetizeSessionLogSchema),
});
