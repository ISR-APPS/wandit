import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2Icon, ShieldAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoginVisualPanel } from "@/features/auth/components/login-visual-panel";
import { authClient } from "@/features/auth/lib/auth-client";
import { getSession, signOut } from "@/features/auth/lib/session";

export function LoginPage() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" });
	const [isSigningIn, setIsSigningIn] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		void getSession().then((session) => {
			if (!cancelled && session?.user.role === "admin") {
				void navigate({ to: "/dashboard" });
			}
		});

		return () => {
			cancelled = true;
		};
	}, [navigate]);

	async function handleGoogleSignIn() {
		setIsSigningIn(true);
		setLocalError(null);

		try {
			const result = await authClient.signIn.social({
				provider: "google",
				callbackURL: `${window.location.origin}/dashboard`,
				errorCallbackURL: `${window.location.origin}/login?error=oauth`,
			});

			if (result.error) {
				setLocalError("Google sign-in failed, try again.");
				setIsSigningIn(false);
				return;
			}

			if (result.data?.url) {
				window.location.assign(result.data.url);
				return;
			}

			setIsSigningIn(false);
		} catch {
			setLocalError("Google sign-in failed, try again.");
			setIsSigningIn(false);
		}
	}

	async function handleSignOut() {
		setIsSigningOut(true);
		try {
			await signOut();
			await navigate({ to: "/login", search: {} });
		} finally {
			setIsSigningOut(false);
		}
	}

	const isForbidden = search.error === "forbidden";
	const errorMessage = isForbidden
		? "This Google account doesn't have admin access."
		: search.error === "oauth"
			? "Google sign-in failed, try again."
			: localError;

	return (
		<main className="flex min-h-[100dvh] pb-8 lg:pb-0">
			<LoginVisualPanel />

			<div className="flex w-full items-center justify-center lg:w-1/2">
				<div className="w-full max-w-md space-y-8 px-4">
					<div className="text-center">
						<h1 className="mt-6 font-bold text-3xl">Welcome back</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Sign in with your Google admin account
						</p>
					</div>

					{errorMessage ? (
						<div
							role="alert"
							className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
						>
							<ShieldAlertIcon
								className="mt-0.5 size-4 shrink-0 text-destructive"
								aria-hidden="true"
							/>
							<div className="flex min-w-0 flex-col gap-2">
								<p className="text-sm">{errorMessage}</p>
								{isForbidden ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-fit"
										onClick={() => void handleSignOut()}
										disabled={isSigningOut}
									>
										{isSigningOut ? (
											<Loader2Icon
												data-icon="inline-start"
												className="animate-spin"
												aria-hidden="true"
											/>
										) : null}
										Sign out
									</Button>
								) : null}
							</div>
						</div>
					) : null}

					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => void handleGoogleSignIn()}
						disabled={isSigningIn}
					>
						{isSigningIn ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									fill="currentColor"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="currentColor"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="currentColor"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="currentColor"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
						)}
						{isSigningIn ? "Redirecting to Google…" : "Continue with Google"}
					</Button>

					<p className="text-center text-muted-foreground text-xs">
						Access is limited to Wandit administrators.
					</p>
				</div>
			</div>
		</main>
	);
}
