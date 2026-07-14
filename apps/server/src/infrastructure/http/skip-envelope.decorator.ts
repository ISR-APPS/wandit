/**
 * Marks a route as "do not wrap the response".
 *
 * Most API routes return JSON and can be wrapped as `{ data, meta }`.
 * SSE routes cannot. They must send raw stream text.
 */
// `SetMetadata` stores a tiny flag on a controller or method. Later an
// interceptor/guard can read that flag with `Reflector`.
import { SetMetadata } from "@nestjs/common";

// The interceptor uses this exact key to find the flag.
export const SKIP_RESPONSE_ENVELOPE_KEY = "wandit:skip-response-envelope";

// Usage: put `@SkipResponseEnvelope()` above a controller method.
export const SkipResponseEnvelope = () =>
	SetMetadata(SKIP_RESPONSE_ENVELOPE_KEY, true);
