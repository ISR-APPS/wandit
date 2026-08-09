/**
 * Nest-coupled wiring, deliberately SEPARATE from ./nestjs: this module pulls
 * in @nestjs/common and @nestjs/core, and the instrument preload (which
 * imports ./nestjs) must never evaluate Nest before Sentry.init has run —
 * otherwise Sentry's Nest instrumentation installs too late.
 *
 * Import this only from module wiring (AppModule, main.ts useLogger), never
 * from instrument files.
 */
import { ConsoleLogger } from "@nestjs/common";
import * as Sentry from "@sentry/node";

/** `SentryModule.forRoot()` goes first in AppModule imports. */
export { SentryModule } from "@sentry/nestjs/setup";

/**
 * Drop-in Nest logger that mirrors warn/error to Sentry Logs. Needed because
 * Nest's default ConsoleLogger writes straight to process.stdout — NOT via
 * console.* — so consoleLoggingIntegration never sees Nest logs.
 * With Sentry disabled (no DSN) the mirror is a no-op and console output is
 * unchanged. Wire with `app.useLogger(new SentryNestLogger())`.
 */
export class SentryNestLogger extends ConsoleLogger {
	override warn(message: unknown, ...rest: unknown[]): void {
		mirrorToSentry("warn", message, rest);
		super.warn(message as string, ...(rest as string[]));
	}

	override error(message: unknown, ...rest: unknown[]): void {
		mirrorToSentry("error", message, rest);
		super.error(message as string, ...(rest as string[]));
	}
}

function mirrorToSentry(
	level: "warn" | "error",
	message: unknown,
	rest: unknown[],
): void {
	const text = typeof message === "string" ? message : JSON.stringify(message);
	// Nest convention: the trailing string param is the context (logger name).
	const last = rest.at(-1);
	Sentry.logger[level](
		text,
		typeof last === "string" ? { context: last } : undefined,
	);
}
