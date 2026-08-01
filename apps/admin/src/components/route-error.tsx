import type { ErrorComponentProps } from "@tanstack/react-router";

/** Generic full-area error state, also used as the Sentry.ErrorBoundary fallback. */
export function ErrorScreen({ message }: { message?: string }) {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
			<h1 className="font-semibold text-xl">Something went wrong</h1>
			{message ? (
				<p className="max-w-md text-muted-foreground text-sm">{message}</p>
			) : null}
			<button
				type="button"
				className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
				onClick={() => window.location.reload()}
			>
				Reload page
			</button>
		</div>
	);
}

/**
 * Router defaultErrorComponent. Presentation only — the Sentry capture for
 * route errors already happened in the router's defaultOnCatch.
 */
export default function RouteError({ error }: ErrorComponentProps) {
	return (
		<ErrorScreen
			message={error instanceof Error ? error.message : String(error)}
		/>
	);
}
