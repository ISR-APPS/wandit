/**
 * Slow reasoning models stay silent for many minutes between streamed chunks
 * while they think, and Node's built-in fetch kills any socket that idles
 * past undici's default 5-minute headers/body timeouts — observed as
 * "TypeError: terminated" mid-build. The Trigger worker only talks to
 * trusted, deliberately long-running AI and storage endpoints, so a generous
 * ceiling beats a mid-build socket kill.
 *
 * Node's global fetch reads its dispatcher from the process-wide undici
 * global-dispatcher symbol, so the npm package's setter applies to it.
 * Import this module before any fetch-issuing SDK work in the task.
 */
import { Agent, setGlobalDispatcher } from "undici";

const ONE_HOUR_MS = 3_600_000;

setGlobalDispatcher(
	new Agent({
		bodyTimeout: ONE_HOUR_MS,
		headersTimeout: ONE_HOUR_MS,
	}),
);
