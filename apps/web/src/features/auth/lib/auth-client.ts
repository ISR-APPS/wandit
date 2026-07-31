import { env } from "@wandit/env/web";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	plugins: [
		adminClient(),
		inferAdditionalFields({
			user: {
				earlyAccess: {
					type: "boolean",
					defaultValue: false,
					input: false,
				},
			},
		}),
	],
});
