// The email code step of the login page. Some backends send a 6-digit code by email at sign-up.
// The person types that code here. A correct code gives the session.
// The step then saves the password of the login form on the confirmed account, and opens /app.
// The login page renders it inside its card. It calls the code and password mutations of auth.mutations.ts.
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import {
	hasAuthErrorCode,
	SessionChangedError,
	useResendEmailCodeMutation,
	useSetAccountPasswordMutation,
	useVerifyEmailCodeMutation,
} from "../api/auth.mutations";
import { emailCodeSchema } from "../lib/schemas";

type EmailCodeStepProps = {
	/**
	 * Address that the person typed in the login form.
	 * A backend that sends the code email sends the code to it, unless the address has a confirmed account.
	 */
	email: string;
	/**
	 * Password that the person typed in the login form, at sign-up or at sign-in. The step holds it in memory only.
	 * After a sign-in, Supabase already accepted it as the account password.
	 */
	password: string;
	/** Closes the step. The login page then shows its form again. */
	onUseOtherEmail: () => void;
};

/**
 * The card slots of the code step: the title, the address, the code field, and the two other actions.
 * No text of this step says if an account exists for the address.
 */
export function EmailCodeStep({
	email,
	password,
	onUseOtherEmail,
}: EmailCodeStepProps) {
	const { t } = useT();
	const navigate = useNavigate();
	const verify = useVerifyEmailCodeMutation();
	const setAccountPassword = useSetAccountPasswordMutation();
	const resend = useResendEmailCodeMutation();
	// True when zod refuses the field before any request: the text is not 6 digits.
	const [isCodeMalformed, setIsCodeMalformed] = useState(false);

	// Supabase accepts a code one time. After a correct code, the code check must not run again.
	const isCodeAccepted = verify.isSuccess;
	const isRequestRunning =
		verify.isPending || setAccountPassword.isPending || resend.isPending;
	// The session of the code check is gone: another tab changed it, or Supabase refused its refresh.
	// A new try of the password save never works.
	const isSessionChanged =
		setAccountPassword.error instanceof SessionChangedError;
	const canRetryPasswordSave = setAccountPassword.isError && !isSessionChanged;
	// After a correct code, only a failed password save can run again. Else the step stays locked while /app loads.
	const isSubmitLocked =
		isRequestRunning || (isCodeAccepted && !canRetryPasswordSave);
	const showCodeError = isCodeMalformed || verify.isError;

	function openApp() {
		navigate({ to: "/app" });
	}

	/**
	 * Runs after a correct code. `userId` is the `auth.users.id` of the session that the code check returned.
	 * A failed save keeps the step open, so the person can try again. Supabase has no single call for the two steps.
	 * If the save never runs, the account keeps the password that it had before the code.
	 */
	function saveAccountPassword(userId: string) {
		// Security: before the confirmation, another person can set or clear the account password. This save replaces it.
		setAccountPassword.mutate({ userId, password }, { onSuccess: openApp });
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isCodeAccepted) {
			saveAccountPassword(verify.data.user.id);
			return;
		}
		const parsed = emailCodeSchema.safeParse(
			Object.fromEntries(new FormData(event.currentTarget)),
		);
		// The result of an earlier "Send a new code" must not show next to the result of this check.
		resend.reset();
		if (!parsed.success) {
			setIsCodeMalformed(true);
			verify.reset();
			return;
		}
		setIsCodeMalformed(false);
		verify.mutate(
			{ email, code: parsed.data.code },
			{ onSuccess: (session) => saveAccountPassword(session.user.id) },
		);
	}

	function onResend() {
		// The error of the old code must not show next to the result of the new request.
		setIsCodeMalformed(false);
		verify.reset();
		resend.mutate(email);
	}

	return (
		<>
			<CardHeader>
				<CardTitle>
					<h1>{t("login.codeTitle")}</h1>
				</CardTitle>
				<CardDescription>{t("login.codeSubtitle")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p dir="auto" className="truncate font-medium text-sm">
					{email}
				</p>
				<form onSubmit={onSubmit} className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="login-code">{t("login.code")}</Label>
						<Input
							id="login-code"
							name="code"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							required
							readOnly={isCodeAccepted}
							// The step replaces the form after a submit, so the focus moves to its only field.
							autoFocus
							aria-invalid={showCodeError}
							aria-describedby={showCodeError ? "login-code-error" : undefined}
						/>
						{showCodeError && (
							<p
								id="login-code-error"
								className="text-destructive text-sm"
								role="alert"
							>
								{t("login.codeError")}
							</p>
						)}
					</div>
					{setAccountPassword.isError && (
						<p className="text-destructive text-sm" role="alert">
							{isSessionChanged
								? t("login.sessionChanged")
								: t("login.passwordSaveError")}
						</p>
					)}
					<Button type="submit" disabled={isSubmitLocked}>
						{verify.isPending || setAccountPassword.isPending
							? t("login.sending")
							: t("login.codeSubmit")}
					</Button>
				</form>
				{/* The region is always in the page, so a screen reader says each new result of "Send a new code". */}
				<div className="grid gap-2 text-sm" aria-live="polite">
					{resend.isSuccess && <p>{t("login.codeResent")}</p>}
					{resend.isError && (
						<p className="text-destructive">
							{hasAuthErrorCode(resend.error, "over_email_send_rate_limit")
								? t("login.emailWait")
								: t("login.codeResendError")}
						</p>
					)}
					{/* Supabase sends no code to an address that already has an account, and says so to nobody. */}
					<p className="text-muted-foreground">{t("login.codeNoEmail")}</p>
				</div>
				<div className="grid gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={isRequestRunning || isCodeAccepted}
						onClick={onResend}
					>
						{resend.isPending ? t("login.sending") : t("login.codeResend")}
					</Button>
					<Button
						type="button"
						variant="link"
						// After a failed password save, this button is the way out: it opens the login form.
						disabled={
							isRequestRunning ||
							(isCodeAccepted && !setAccountPassword.isError)
						}
						onClick={onUseOtherEmail}
					>
						{t("login.useOtherEmail")}
					</Button>
				</div>
			</CardContent>
		</>
	);
}
