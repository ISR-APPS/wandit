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
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
