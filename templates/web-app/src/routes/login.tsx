// Public login route: Supabase email and password, client-side only logic.
// The landing nav and the /app session check open it. On success it opens /app.
// Email confirmation is off for the project, so sign-up returns a session at once.
import type { Session } from "@supabase/supabase-js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n";
import { getSupabase } from "~/lib/supabase";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

type LoginMode = "signIn" | "signUp";

type LoginState = "idle" | "sending" | "passwordMismatch" | "error";

// Supabase Auth refuses a password shorter than 6 characters by default.
const MIN_PASSWORD_LENGTH = 6;

const signInSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

// The refine stops the signUp call when the two passwords differ.
const signUpSchema = signInSchema
	.extend({
		password: z.string().min(MIN_PASSWORD_LENGTH),
		confirmPassword: z.string(),
	})
	.refine((fields) => fields.password === fields.confirmPassword, {
		path: ["confirmPassword"],
	});

type Credentials = z.infer<typeof signInSchema>;

// Returns the new session. Returns null on a Supabase error or when sign-up gives no session.
async function requestSession(
	mode: LoginMode,
	credentials: Credentials,
): Promise<Session | null> {
	const auth = getSupabase().auth;
	const { data, error } =
		mode === "signUp"
			? await auth.signUp(credentials)
			: await auth.signInWithPassword(credentials);
	if (error) {
		console.error("Supabase refused the login form", error.message);
		return null;
	}
	if (!data.session) {
		// Only a project with email confirmation on returns no session.
		console.error("Supabase returned no session after sign-up");
	}
	return data.session;
}

function LoginPage() {
	const { t } = useT();
	const navigate = useNavigate();
	const [mode, setMode] = useState<LoginMode>("signIn");
	const [state, setState] = useState<LoginState>("idle");

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const fields = Object.fromEntries(new FormData(event.currentTarget));
		const parsed =
			mode === "signUp"
				? signUpSchema.safeParse(fields)
				: signInSchema.safeParse(fields);
		if (!parsed.success) {
			// The refine puts a password mismatch on the confirmPassword field.
			const isMismatch = parsed.error.issues.some(
				(issue) => issue.path[0] === "confirmPassword",
			);
			setState(isMismatch ? "passwordMismatch" : "error");
			return;
		}
		setState("sending");
		try {
			const session = await requestSession(mode, {
				email: parsed.data.email,
				password: parsed.data.password,
			});
			if (!session) {
				setState("error");
				return;
			}
			void navigate({ to: "/app" });
		} catch (error) {
			// A thrown error must not leave the button on "sending".
			console.error("Login request failed", error);
			setState("error");
		}
	}

	function switchMode() {
		setMode(mode === "signIn" ? "signUp" : "signIn");
		setState("idle");
	}

	const isSignUp = mode === "signUp";
	const submitLabel = isSignUp ? t("login.signUpSubmit") : t("login.submit");

	return (
		<div className="flex min-h-svh items-center justify-center bg-background px-6">
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
						{state === "passwordMismatch" && (
							<p className="text-destructive text-sm" role="alert">
								{t("login.passwordMismatch")}
							</p>
						)}
						{state === "error" && (
							<p className="text-destructive text-sm" role="alert">
								{isSignUp ? t("login.signUpError") : t("login.error")}
							</p>
						)}
						<Button type="submit" disabled={state === "sending"}>
							{state === "sending" ? t("login.sending") : submitLabel}
						</Button>
					</form>
					<Button
						type="button"
						variant="link"
						className="mt-2 w-full"
						disabled={state === "sending"}
						onClick={switchMode}
					>
						{isSignUp ? t("login.toSignIn") : t("login.toSignUp")}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
