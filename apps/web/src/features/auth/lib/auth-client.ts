import {
	workspaceAccessControl,
	workspaceRoles,
} from "@wandit/auth/permissions";
import { env } from "@wandit/env/web";
import {
	adminClient,
	emailOTPClient,
	inferAdditionalFields,
	magicLinkClient,
	organizationClient,
} from "better-auth/client/plugins";
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
		inferAdditionalFields({
			user: {
				onboardingCompletedAt: {
					type: "date",
					required: false,
				},
			},
		}),
		adminClient(),
		// Email sign-in (magic link + OTP fallback) — dark behind the
		// emailAuthEnabled public setting; the auth modal gates the UI.
		magicLinkClient(),
		emailOTPClient(),
		// Same access-control matrix as the server plugin — client-side
		// permission checks stay cosmetic; the API enforces for real.
		organizationClient({
			ac: workspaceAccessControl,
			roles: workspaceRoles,
		}),
	],
});
