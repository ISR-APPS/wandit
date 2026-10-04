/**
 * Shows a password form for the existing local development account.
 * The auth modal calls this component only in development builds.
 * It calls Better Auth and opens the requested local path after sign-in.
 */
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { isLocalhostUrl } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/web";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { buildAuthCallbackUrls } from "@/lib/auth-navigation";
import { useTranslation } from "@/lib/i18n";

import { authClient } from "../lib/auth-client";
import { invalidateSessionCache } from "../lib/session";

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
	/** Removes a previous failure before a new attempt. */
	onClearError: () => void;
}) {
	const { t } = useTranslation();
	const [email, setEmail] = useState<string>(DEV_USER.email);
	const [password, setPassword] = useState<string>(DEV_USER.password);
	const [isPending, setIsPending] = useState(false);

	// Public browser or API hosts must not offer the shared development credentials.
	if (
		!import.meta.env.DEV ||
		!isLocalhostUrl(window.location.origin) ||
		!isLocalhostUrl(env.VITE_SERVER_URL)
	) {
		return null;
	}

	const signIn = async () => {
		// An active request must finish before the form can send another request.
		if (isPending) return;
		onClearError();
		setIsPending(true);
		try {
			const result = await authClient.signIn.email({ email, password });
			if (result.error) {
				onError(result.error.message || t("auth.devSignInFailed"));
				setIsPending(false);
				return;
			}
			// The dashboard consumes the saved prompt after password sign-in.
			invalidateSessionCache();
			const destination =
				nextPath && nextPath !== "/" ? nextPath : "/dashboard";
			const { callbackURL } = buildAuthCallbackUrls(
				window.location.origin,
				destination,
			);
			window.location.assign(callbackURL);
		} catch (error) {
			onError(
				error instanceof Error ? error.message : t("auth.devSignInFailed"),
			);
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
					{t("auth.devOnly")}
				</span>
				<span className="h-px flex-1 bg-border" />
			</div>
			<Input
				type="email"
				required
				autoComplete="username"
				aria-label={t("auth.emailLabel")}
				className="h-11 rounded-full px-4"
				disabled={isPending}
				value={email}
				onChange={(event) => setEmail(event.target.value)}
			/>
			<Input
				type="password"
				required
				autoComplete="current-password"
				aria-label={t("auth.devPassword")}
				className="h-11 rounded-full px-4"
				disabled={isPending}
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
				{t("auth.devSignIn")}
			</Button>
		</form>
	);
}
