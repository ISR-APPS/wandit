const PUBLIC_LEAD_CAPTURE_URL = /^\/api\/public\/leads\/[^/?]+(?:\?.*)?$/;

const PUBLIC_LEAD_CAPTURE_CORS_OPTIONS = {
	allowedHeaders: ["Content-Type"],
	credentials: false,
	exposedHeaders: ["Retry-After"],
	maxAge: 86_400,
	methods: ["POST"],
	origin: "*",
};

/**
 * Returns the credentialless CORS policy for the one public lead-capture
 * route. Fastify's CORS delegator also sees preflight requests at their
 * requested URL, so this covers both POST responses and OPTIONS handshakes.
 */
export function publicLeadCaptureCorsOptions(url: string) {
	return PUBLIC_LEAD_CAPTURE_URL.test(url)
		? PUBLIC_LEAD_CAPTURE_CORS_OPTIONS
		: null;
}
