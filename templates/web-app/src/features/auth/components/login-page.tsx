// Sign-in and sign-up form with Supabase email and password. The /login route renders it.
// It parses the fields with zod, calls a mutation of auth.mutations.ts, then opens /app.
// Email confirmation is off for the project, so sign-up returns a session at once.
import { useNavigate } from "@tanstack/react-router";
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
import { useSignInMutation, useSignUpMutation } from "../api/auth.mutations";
import {
	MIN_PASSWORD_LENGTH,
	signInSchema,
	signUpSchema,
} from "../lib/schemas";

type LoginMode = "signIn" | "signUp";

/** A form problem that zod finds before any request. Request errors come from the mutation. */
type FormIssue = "passwordMismatch" | "invalid";

export function LoginPage() {
	const { t } = useT();
	const navigate = useNavigate();
	const [mode, setMode] = useState<LoginMode>("signIn");
	const [formIssue, setFormIssue] = useState<FormIssue | null>(null);
	const signIn = useSignInMutation();
	const signUp = useSignUpMutation();

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
		request.mutate(
			{ email: parsed.data.email, password: parsed.data.password },
			{ onSuccess: () => navigate({ to: "/app" }) },
		);
	}

	function switchMode() {
		setMode(isSignUp ? "signIn" : "signUp");
		setFormIssue(null);
		signIn.reset();
		signUp.reset();
	}

	const showError = formIssue === "invalid" || request.isError;

	return (
		<div className="relative flex min-h-svh items-center justify-center bg-background px-6">
			{/* An internal tool has no landing page, so the login page carries the language switcher. */}
			<div className="absolute end-6 top-6">
				<LocaleSwitcher />
			</div>
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>
						{isSignUp ? t("login.signUpTitle") : t("login.title")}
					</CardTitle>
					<CardDescription>
						{isSignUp ? t("login.signUpSubtitle") : t("login.subtitle")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSubmit} className="grid gap-4">
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
								autoComplete={isSignUp ? "new-password" : "current-password"}
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
								{isSignUp ? t("login.signUpError") : t("login.error")}
							</p>
						)}
						<Button type="submit" disabled={request.isPending}>
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
			</Card>
		</div>
	);
}
