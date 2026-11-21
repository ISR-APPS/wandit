// Sign-in and sign-up form with Supabase email and password. The /login route renders it.
// It parses the fields with zod, calls a mutation of auth.mutations.ts, then opens /app.
// A backend that sends the code email gives no session at sign-up. Then the email code step shows in the same card.
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import {
	hasAuthErrorCode,
	useSignInMutation,
	useSignUpMutation,
} from "../api/auth.mutations";
import {
	MIN_PASSWORD_LENGTH,
	signInSchema,
	signUpSchema,
} from "../lib/schemas";
import { EmailCodeStep } from "./email-code-step";

type LoginMode = "signIn" | "signUp";

/** A form problem that zod finds before any request. Request errors come from the mutation. */
type FormIssue = "passwordMismatch" | "invalid";

/** An account that waits for its email code. */
type PendingConfirmation = {
	/** Address that the person typed in the form. */
	email: string;
	/** Password that the person typed in the form, at sign-up or at sign-in. The code step saves it on the account. */
	password: string;
};

/** The /login page. It shows the form, or the email code step when an account waits for its confirmation. */
export function LoginPage() {
	const { t } = useT();
	const navigate = useNavigate();
	const [mode, setMode] = useState<LoginMode>("signIn");
	const [formIssue, setFormIssue] = useState<FormIssue | null>(null);
	// Not null: the code step shows in place of the form.
	const [pendingConfirmation, setPendingConfirmation] =
		useState<PendingConfirmation | null>(null);
	const signIn = useSignInMutation();
	const signUp = useSignUpMutation();
	// The page is prerendered. Before hydration, onSubmit does not exist, so the button stays disabled.
	const isHydrated = useHydrated();

	const isSignUp = mode === "signUp";
	const request = isSignUp ? signUp : signIn;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const fields = Object.fromEntries(new FormData(event.currentTarget));
		const parsed = isSignUp
			? signUpSchema.safeParse(fields)
			: signInSchema.safeParse(fields);
		if (!parsed.success) {
			// The refine puts a password mismatch on the confirmPassword field.
			const isMismatch = parsed.error.issues.some(
				(issue) => issue.path[0] === "confirmPassword",
			);
			setFormIssue(isMismatch ? "passwordMismatch" : "invalid");
			// The error of an earlier request must not show next to the new form problem.
			request.reset();
			return;
		}
		setFormIssue(null);
		const { email, password } = parsed.data;
		if (isSignUp) {
			signUp.mutate(
				{ email, password },
				{
					onSuccess: (session) => {
						// A backend that sends no email gives the session at once.
						if (session) {
							navigate({ to: "/app" });
						} else {
							// No session: this backend sends the code email. The code step saves the password after a correct code.
							setPendingConfirmation({ email, password });
						}
					},
				},
			);
			return;
		}
		signIn.mutate(
			{ email, password },
			{
				onSuccess: () => navigate({ to: "/app" }),
				onError: (error) => {
					// Supabase refuses a correct password while the email is not confirmed. The code step confirms it.
					if (hasAuthErrorCode(error, "email_not_confirmed")) {
						// Security: a direct call to Supabase can clear this password before the code. The step saves it again.
						setPendingConfirmation({ email, password });
					}
				},
			},
		);
	}

	/** Shows an empty form: no form problem and no result of an earlier request. */
	function clearForm() {
		setFormIssue(null);
		signIn.reset();
		signUp.reset();
	}

	function switchMode() {
		setMode(isSignUp ? "signIn" : "signUp");
		clearForm();
	}

	function closeCodeStep() {
		setPendingConfirmation(null);
		clearForm();
	}

	const showError = formIssue === "invalid" || request.isError;
	// Supabase limits the emails that it sends. Only a sign-up on a backend that sends the code email gets this error.
	const isEmailRateLimited = hasAuthErrorCode(
		request.error,
		"over_email_send_rate_limit",
	);

	return (
		<div className="relative flex min-h-svh items-center justify-center bg-background px-6">
			{/* An internal tool has no landing page, so the login page carries the language switcher. */}
			<div className="absolute end-6 top-6">
				<LocaleSwitcher />
			</div>
			<Card className="w-full max-w-sm">
				{pendingConfirmation ? (
					<EmailCodeStep
						email={pendingConfirmation.email}
						password={pendingConfirmation.password}
						onUseOtherEmail={closeCodeStep}
					/>
				) : (
					<>
						<CardHeader>
							<CardTitle>
								{isSignUp ? t("login.signUpTitle") : t("login.title")}
							</CardTitle>
							<CardDescription>
								{isSignUp ? t("login.signUpSubtitle") : t("login.subtitle")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{/* A native submit must never put the password in the URL. POST sends it in the body. */}
							<form method="post" onSubmit={onSubmit} className="grid gap-4">
								<div className="grid gap-2">
									<Label htmlFor="login-email">{t("login.email")}</Label>
									<Input
										id="login-email"
										name="email"
										type="email"
										required
										autoComplete="email"
										placeholder={t("login.emailPlaceholder")}
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="login-password">{t("login.password")}</Label>
									<Input
										id="login-password"
										name="password"
										type="password"
										required
										minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
										autoComplete={
											isSignUp ? "new-password" : "current-password"
										}
									/>
								</div>
								{isSignUp && (
									<div className="grid gap-2">
										<Label htmlFor="login-confirm-password">
											{t("login.confirmPassword")}
										</Label>
										<Input
											id="login-confirm-password"
											name="confirmPassword"
											type="password"
											required
											autoComplete="new-password"
										/>
									</div>
								)}
								{formIssue === "passwordMismatch" && (
									<p className="text-destructive text-sm" role="alert">
										{t("login.passwordMismatch")}
									</p>
								)}
								{showError && (
									<p className="text-destructive text-sm" role="alert">
										{isEmailRateLimited
											? t("login.emailWait")
											: isSignUp
												? t("login.signUpError")
												: t("login.error")}
									</p>
								)}
								<Button
									type="submit"
									disabled={!isHydrated || request.isPending}
								>
									{request.isPending
										? t("login.sending")
										: isSignUp
											? t("login.signUpSubmit")
											: t("login.submit")}
								</Button>
							</form>
							<Button
								type="button"
								variant="link"
								className="mt-2 w-full"
								disabled={request.isPending}
								onClick={switchMode}
							>
								{isSignUp ? t("login.toSignIn") : t("login.toSignUp")}
							</Button>
						</CardContent>
					</>
				)}
			</Card>
		</div>
	);
}
