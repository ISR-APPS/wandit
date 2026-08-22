import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "EXPO_PUBLIC_",
	client: {
		EXPO_PUBLIC_SERVER_URL: z.url(),
		// Trigger.dev API the realtime run subscription talks to directly
		// (with the read-scoped public token minted server-side). Cloud by
		// default; override for self-hosted instances.
		EXPO_PUBLIC_TRIGGER_API_URL: z.url().default("https://api.trigger.dev"),
		// Web-app origin (NOT the API): billing has no native flow, so upgrade
		// CTAs hand off to the web app in the system browser. Full absolute URL;
		// the default matches the web app's vite dev port (apps/web/vite.config.ts).
		EXPO_PUBLIC_WEB_APP_URL: z.url().default("http://localhost:3001"),
	},
	// Static member accesses on purpose: babel-preset-expo inlines
	// process.env.EXPO_PUBLIC_* into release bundles only when written exactly
	// like this — a bare `process.env` object stays empty outside dev, and the
	// schema above would then throw at app launch.
	runtimeEnv: {
		EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL,
		EXPO_PUBLIC_TRIGGER_API_URL: process.env.EXPO_PUBLIC_TRIGGER_API_URL,
		EXPO_PUBLIC_WEB_APP_URL: process.env.EXPO_PUBLIC_WEB_APP_URL,
	},
	emptyStringAsUndefined: true,
});
