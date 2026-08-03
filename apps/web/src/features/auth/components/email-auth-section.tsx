import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { env } from "@wandit/env/web";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { buildAuthCallbackUrls } from "@/lib/auth-navigation";
import { useTranslation } from "@/lib/i18n";
import { authClient } from "../lib/auth-client";
import { invalidateSessionCache } from "../lib/session";

/**
 * Email sign-in inside the auth modal: magic link first, "enter a code
 * instead" OTP fallback. Both SEND actions carry a Turnstile token (when the
 * site key is configured) via the x-captcha-response header the server-side
 * captcha plugin checks; OTP verification is deliberately captcha-free.
 * Tokens are single-use, so every send consumes the token and resets the
 * widget for the next one.
 */

type SendErrorShape = {
	code?: string | null | undefined;
	message?: string | null | undefined;
	status?: number | undefined;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export function EmailAuthSection({
	nextPath,
	onError,
	onClearError,
}: {
	nextPath: string | undefined;
	onError: (message: string) => void;
	onClearError: () => void;
}) {
	const { t } = useTranslation();
	const [view, setView] = useState<"form" | "sent">("form");
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpRequested, setOtpRequested] = useState(false);
	const [pending, setPending] = useState<
		"none" | "link" | "otp-send" | "otp-verify"
	>("none");
	const [linkCooldown, setLinkCooldown] = useState(0);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const turnstileRef = useRef<TurnstileInstance | null>(null);

	const siteKey = env.VITE_TURNSTILE_SITE_KEY;
	// No key configured ⇒ the server has no captcha plugin either.
	const captchaReady = !siteKey || Boolean(captchaToken);
	// A widget that errors out (offline, blocked script) would otherwise leave
	// every button disabled with nothing on screen explaining why.
	const [captchaBroken, setCaptchaBroken] = useState(false);

	const retryCaptcha = () => {
		setCaptchaBroken(false);
		setCaptchaToken(null);
		turnstileRef.current?.reset();
	};

	useEffect(() => {
		if (linkCooldown <= 0) return;
		const timer = setInterval(() => {
			setLinkCooldown((seconds) => Math.max(0, seconds - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, [linkCooldown]);

	const mapError = (error: SendErrorShape | null | undefined): string => {
		switch (error?.code) {
			case "EMAIL_AUTH_DISABLED":
				return t("auth.emailDisabled");
			case "EMAIL_DOMAIN_BLOCKED":
				return t("auth.emailDomainBlocked");
			case "EMAIL_SEND_RATE_LIMITED":
				return t("auth.emailRateLimited");
			case "EMAIL_DELIVERY_UNAVAILABLE":
				return t("auth.emailDeliveryFailed");
			case "INVALID_OTP":
				return t("auth.otpInvalid");
			case "OTP_EXPIRED":
				return t("auth.otpExpired");
			case "TOO_MANY_ATTEMPTS":
				return t("auth.otpTooManyAttempts");
			default:
				break;
		}
		if (error?.status === 429) {
			return t("auth.emailRateLimited");
		}
		// Captcha plugin rejections (missing/failed verification).
		if (error?.status === 403 || error?.status === 400) {
			return t("auth.captchaFailed");
		}
		return t("auth.emailSendError");
	};

	// Every send consumes the single-use Turnstile token; mint a new one.
	const consumeCaptcha = (): Record<string, string> => {
		const headers: Record<string, string> = captchaToken
			? { "x-captcha-response": captchaToken }
			: {};
		if (siteKey) {
			setCaptchaToken(null);
			turnstileRef.current?.reset();
		}
		return headers;
	};

	const sendMagicLink = async () => {
		if (pending !== "none" || !captchaReady) return;
		onClearError();
		setPending("link");

		const destination = nextPath && nextPath !== "/" ? nextPath : "/dashboard";
		const { callbackURL, errorCallbackURL } = buildAuthCallbackUrls(
			window.location.origin,
			destination,
		);

		try {
			const result = await authClient.signIn.magicLink(
				{
					email,
					callbackURL,
					newUserCallbackURL: callbackURL,
					errorCallbackURL,
				},
				{ headers: consumeCaptcha() },
			);
			if (result.error) {
				onError(mapError(result.error));
				return;
			}
			setView("sent");
			setOtp("");
			setOtpRequested(false);
			setLinkCooldown(RESEND_COOLDOWN_SECONDS);
		} catch {
			onError(t("auth.emailSendError"));
		} finally {
			setPending("none");
		}
	};

	const sendOtp = async () => {
		if (pending !== "none" || !captchaReady) return;
		onClearError();
		setPending("otp-send");
		try {
			const result = await authClient.emailOtp.sendVerificationOtp(
				{ email, type: "sign-in" },
				{ headers: consumeCaptcha() },
			);
			if (result.error) {
				onError(mapError(result.error));
				return;
			}
			setOtpRequested(true);
		} catch {
			onError(t("auth.emailSendError"));
		} finally {
			setPending("none");
		}
	};

	const verifyOtp = async () => {
		if (pending !== "none" || otp.length !== OTP_LENGTH) return;
		onClearError();
		setPending("otp-verify");
		try {
			const result = await authClient.signIn.emailOtp({ email, otp });
			if (result.error) {
				setOtp("");
				onError(mapError(result.error));
				setPending("none");
				return;
			}
			// Unlike Google and magic link — which arrive back through a
			// server redirect — OTP verification finishes in place, so this
			// has to perform the navigation itself. Assign immediately so the
			// reload happens before the session effect can close the modal and
			// drop a stashed prompt that the destination page still needs.
			invalidateSessionCache();
			const destination =
				nextPath && nextPath !== "/" ? nextPath : "/dashboard";
			window.location.assign(
				new URL(destination, window.location.origin).toString(),
			);
		} catch {
			onError(t("auth.emailSendError"));
			setPending("none");
		}
	};

	const backToForm = () => {
		onClearError();
		setView("form");
		setOtp("");
		setOtpRequested(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-muted-foreground/70 text-xs uppercase tracking-wide">
					{t("auth.emailDivider")}
				</span>
				<span className="h-px flex-1 bg-border" />
			</div>

			{view === "form" ? (
				<form
					className="flex flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						void sendMagicLink();
					}}
				>
					<Input
						type="email"
						required
						autoComplete="email"
						aria-label={t("auth.emailLabel")}
						placeholder={t("auth.emailPlaceholder")}
						className="h-11 rounded-full px-4"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
					<Button
						type="submit"
						variant="outline"
						className="h-11 w-full rounded-full"
						disabled={pending !== "none" || !captchaReady}
					>
						{pending === "link" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Mail className="size-4" />
						)}
						{pending === "link"
							? t("auth.emailSending")
							: t("auth.emailContinue")}
					</Button>
				</form>
			) : (
				<div className="flex flex-col gap-3">
					<div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
						<p className="font-medium text-sm">{t("auth.emailSentTitle")}</p>
						<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
							{t(
								otpRequested ? "auth.emailCodeSent" : "auth.emailSentBody",
								{ email },
							)}
						</p>
					</div>

					{otpRequested ? (
						<form
							className="flex flex-col gap-3"
							onSubmit={(event) => {
								event.preventDefault();
								void verifyOtp();
							}}
						>
							<Input
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]*"
								aria-label={t("auth.otpLabel")}
								placeholder="000000"
								className="h-11 rounded-full text-center font-semibold text-lg tracking-[0.5em]"
								value={otp}
								// Strip non-digits BEFORE bounding the length: a
								// pasted "123 456" would otherwise be truncated to
								// "123 45" first and silently lose a digit. (No
								// maxLength on the input, for the same reason.)
								onChange={(event) =>
									setOtp(
										event.target.value
											.replaceAll(/\D/g, "")
											.slice(0, OTP_LENGTH),
									)
								}
							/>
							<Button
								type="submit"
								className="h-11 w-full rounded-full"
								disabled={pending !== "none" || otp.length !== OTP_LENGTH}
							>
								{pending === "otp-verify" ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								{pending === "otp-verify"
									? t("auth.otpVerifying")
									: t("auth.otpVerify")}
							</Button>
						</form>
					) : (
						<Button
							type="button"
							variant="outline"
							className="h-11 w-full rounded-full"
							disabled={pending !== "none" || !captchaReady}
							onClick={() => void sendOtp()}
						>
							{pending === "otp-send" ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{pending === "otp-send"
								? t("auth.emailSending")
								: t("auth.emailUseCode")}
						</Button>
					)}

					<div className="flex items-center justify-center gap-4 text-xs">
						<button
							type="button"
							className="text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
							disabled={
								pending !== "none" || linkCooldown > 0 || !captchaReady
							}
							// Resend whichever channel the user is actually on:
							// re-sending the link from the code screen would wipe
							// the entry form and strand a code they just received.
							onClick={() =>
								void (otpRequested ? sendOtp() : sendMagicLink())
							}
						>
							{linkCooldown > 0
								? t("auth.emailResendIn", { seconds: linkCooldown })
								: t(
										otpRequested
											? "auth.emailResendCode"
											: "auth.emailResend",
									)}
						</button>
						<button
							type="button"
							className="text-muted-foreground underline-offset-2 hover:underline"
							onClick={backToForm}
						>
							{t("auth.emailBack")}
						</button>
					</div>
				</div>
			)}

			{siteKey ? (
				<div className="w-full overflow-x-auto">
					<Turnstile
						ref={turnstileRef}
						siteKey={siteKey}
						options={{ size: "flexible", theme: "auto" }}
						onSuccess={(token) => {
							setCaptchaBroken(false);
							setCaptchaToken(token);
						}}
						onExpire={() => setCaptchaToken(null)}
						onError={() => {
							setCaptchaToken(null);
							setCaptchaBroken(true);
						}}
					/>
					{captchaBroken ? (
						<button
							type="button"
							className="mt-2 w-full text-center text-muted-foreground text-xs underline-offset-2 hover:underline"
							onClick={retryCaptcha}
						>
							{t("auth.captchaRetry")}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
