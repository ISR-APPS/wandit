import { env } from "@wandit/env/web";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { withAffiliateTokenForAuthRequest } from "@/features/affiliates/lib/affiliate-capture";

export const authClient = createAuthClient({
	baseURL: env.VITE_SERVER_URL,
	fetchOptions: {
		onRequest(context) {
			if (typeof window === "undefined") {
				return;
			}

			const body = withAffiliateTokenForAuthRequest(
				context.url,
				context.body,
				window.localStorage,
			);

			if (body !== context.body) {
				return { ...context, body };
			}
		},
	},
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
