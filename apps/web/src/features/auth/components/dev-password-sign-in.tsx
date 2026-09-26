/**
 * Email and password sign-in for local development. The auth modal renders it only under `vite dev`.
 * The fields start with DEV_USER, so a browser agent signs in with one click.
 * Calls Better Auth `/sign-in/email`. The API accepts it only on localhost (packages/auth/src/dev-password-login.ts).
 */
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { authClient } from "../lib/auth-client";
import { invalidateSessionCache } from "../lib/session";

const SIGN_IN_FAILED_MESSAGE = "Dev sign-in failed.";

/** Dev-only form. It navigates on success and reports errors to the auth modal alert. */
export function DevPasswordSignIn({
	nextPath,
	onError,
	onClearError,
}: {
	/** Sanitized path to open after sign-in. Undefined or "/" opens the dashboard. */
	nextPath: string | undefined;
	/** Shows the message in the auth modal alert. */
	onError: (message: string) => void;
	onClearError: () => void;
}) {
	const [email, setEmail] = useState<string>(DEV_USER.email);
	const [password, setPassword] = useState<string>(DEV_USER.password);
	const [isPending, setIsPending] = useState(false);

	const signIn = async () => {
		if (isPending) return;
		onClearError();
		setIsPending(true);
		try {
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				onError(result.error.message || SIGN_IN_FAILED_MESSAGE);
				setIsPending(false);
				return;
			}
			// Password sign-in finishes in place, like OTP. Navigate here, so the
			// dashboard can consume the stashed prompt.
			invalidateSessionCache();
			const destination =
				nextPath && nextPath !== "/" ? nextPath : "/dashboard";
			window.location.assign(
				new URL(destination, window.location.origin).toString(),
			);
		} catch (error) {
			onError(error instanceof Error ? error.message : SIGN_IN_FAILED_MESSAGE);
			setIsPending(false);
		}
	};

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				void signIn();
			}}
		>
			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-muted-foreground/70 text-xs uppercase tracking-wide">
					Dev only
				</span>
				<span className="h-px flex-1 bg-border" />
			</div>
			<Input
				type="email"
				required
				autoComplete="username"
				aria-label="Dev email"
				className="h-11 rounded-full px-4"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
			/>
			<Input
				type="password"
				required
				autoComplete="current-password"
				aria-label="Dev password"
				className="h-11 rounded-full px-4"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
			/>
			<Button
				type="submit"
				variant="outline"
				className="h-11 w-full rounded-full"
				disabled={isPending}
			>
				{isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<KeyRound className="size-4" />
				)}
				Dev sign-in
			</Button>
		</form>
	);
}
