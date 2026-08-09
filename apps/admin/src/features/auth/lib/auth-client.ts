import { createAuthClient } from "better-auth/react";

import { getServerUrl } from "@/lib/server-url";

export const authClient = createAuthClient({
	baseURL: getServerUrl(),
});
