/**
 * Sign-in modal at route "/sign-in": sign in or create an account with email
 * and password, under a brand block in the colors of the design world. The root
 * layout guards the route with Stack.Protected, so the modal closes by itself
 * when the session arrives. The route param `mode=sign-up` opens it in sign-up mode.
 * The code view replaces the form while an account waits for the code of its sign-up email.
 * After a right code, the code view saves the password of the form before the session arrives.
 */
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { z } from "zod";
import { useT } from "@/i18n";
import { AppButton, AppText, AppTextField, Screen } from "@/shared/ui";
import {
	authErrorKey,
	isEmailNotConfirmedError,
	useEmailCodeConfirmation,
	useResendEmailCode,
	useSignIn,
	useSignUp,
} from "../api/auth.mutations";
import {
	EMAIL_CODE_LENGTH,
	emailCodeSchema,
	signInSchema,
	signUpSchema,
} from "../lib/auth.schemas";

/** The field names of the last failed zod check; a missing field passed. */
type FieldErrors = Partial<
	Record<"email" | "password" | "confirmPassword", string[]>
>;

/**
 * One form for sign-in and sign-up, and the code view. A failed call shows a
 * translated error, never the raw text. The app does not know the backend mode.
 * A session closes the modal. An account that waits for its code opens the code view.
 */
export function SignInScreen() {
	const { t } = useT();
	// A welcome screen sends a new user here with `mode=sign-up`, so the form opens on sign-up.
	const { mode } = useLocalSearchParams<{ mode?: string }>();
	const [isSignUp, setIsSignUp] = useState(mode === "sign-up");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const passwordRef = useRef<TextInput>(null);
	const confirmRef = useRef<TextInput>(null);
	const signIn = useSignIn();
	const signUp = useSignUp();
	const active = isSignUp ? signUp : signIn;

	function submit() {
		// The keyboard can submit a focused field again while the call runs.
		if (active.isPending) {
			return;
		}
		const values = { email, password, confirmPassword };
		if (isSignUp) {
			const parsed = signUpSchema.safeParse(values);
			setFieldErrors(
				parsed.success ? {} : z.flattenError(parsed.error).fieldErrors,
			);
			if (parsed.success) {
				signUp.mutate(parsed.data);
			}
			return;
		}
		const parsed = signInSchema.safeParse(values);
		setFieldErrors(
			parsed.success ? {} : z.flattenError(parsed.error).fieldErrors,
		);
		if (parsed.success) {
			signIn.mutate(parsed.data);
		}
	}

	function switchMode() {
		setIsSignUp(!isSignUp);
		setFieldErrors({});
		active.reset();
	}

	function leaveCodeView() {
		// The two answers that open the code view go away, so the form shows again.
		signUp.reset();
		signIn.reset();
	}

	// A backend that sends the code email gives no session at sign-up. It also refuses a
	// sign-in until the code is right. The app learns the mode only from these two answers.
	// Supabase checks the password before it refuses a sign-in, so each form has one to save.
	if (signUp.isSuccess && signUp.data.kind === "confirm-email") {
		return (
			<EmailCodeView
				email={signUp.data.email}
				formPassword={signUp.variables.password}
				isAfterRefusedSignIn={false}
				onUseAnotherEmail={leaveCodeView}
			/>
		);
	}
	if (signIn.isError && isEmailNotConfirmedError(signIn.error)) {
		return (
			<EmailCodeView
				email={signIn.variables.email}
				formPassword={signIn.variables.password}
				isAfterRefusedSignIn
				onUseAnotherEmail={leaveCodeView}
			/>
		);
	}

	return (
		<Screen className="gap-5">
			{/* The modal header shows the title of the current mode. */}
			<Stack.Screen
				options={{
					title: isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle"),
				}}
			/>
			<BrandBlock
				body={t("auth.headlineBody")}
				headline={
					isSignUp ? t("auth.signUpHeadline") : t("auth.signInHeadline")
				}
			/>
			<AppTextField isInvalid={fieldErrors.email !== undefined} isRequired>
				<AppTextField.Label>{t("auth.email")}</AppTextField.Label>
				<AppTextField.Input
					autoCapitalize="none"
					autoComplete="email"
					keyboardType="email-address"
					onChangeText={setEmail}
					onSubmitEditing={() => passwordRef.current?.focus()}
					returnKeyType="next"
					textContentType="emailAddress"
					value={email}
				/>
				<AppTextField.FieldError>
					{t("auth.errors.email")}
				</AppTextField.FieldError>
			</AppTextField>
			<AppTextField isInvalid={fieldErrors.password !== undefined} isRequired>
				<AppTextField.Label>{t("auth.password")}</AppTextField.Label>
				<AppTextField.Input
					autoComplete={isSignUp ? "new-password" : "current-password"}
					onChangeText={setPassword}
					onSubmitEditing={() =>
						isSignUp ? confirmRef.current?.focus() : submit()
					}
					ref={passwordRef}
					returnKeyType={isSignUp ? "next" : "go"}
					secureTextEntry
					textContentType={isSignUp ? "newPassword" : "password"}
					value={password}
				/>
				<AppTextField.FieldError>
					{isSignUp
						? t("auth.errors.passwordShort")
						: t("auth.errors.passwordRequired")}
				</AppTextField.FieldError>
			</AppTextField>
			{isSignUp ? (
				<AppTextField
					isInvalid={fieldErrors.confirmPassword !== undefined}
					isRequired
				>
					<AppTextField.Label>{t("auth.confirmPassword")}</AppTextField.Label>
					<AppTextField.Input
						autoComplete="new-password"
						onChangeText={setConfirmPassword}
						onSubmitEditing={submit}
						ref={confirmRef}
						returnKeyType="go"
						secureTextEntry
						textContentType="newPassword"
						value={confirmPassword}
					/>
					<AppTextField.FieldError>
						{t("auth.errors.passwordsDiffer")}
					</AppTextField.FieldError>
				</AppTextField>
			) : null}
			{active.error ? (
				<AppText className="text-danger" variant="caption">
					{t(authErrorKey(active.error))}
				</AppText>
			) : null}
			<AppButton isDisabled={active.isPending} onPress={submit}>
				{isSignUp ? t("auth.signUp") : t("auth.signIn")}
			</AppButton>
			<AppButton onPress={switchMode} variant="ghost">
				{isSignUp ? t("auth.toSignIn") : t("auth.toSignUp")}
			</AppButton>
		</Screen>
	);
}

/**
 * The brand block of the form and of the code view: the hero gradient of the world.
 * One component, so the two views read as one screen. Both texts arrive translated.
 */
function BrandBlock({ headline, body }: { headline: string; body: string }) {
	return (
		// 400 ms: a short entry, so the fields below do not wait.
		// Reanimated skips the entry when the system asks for reduced motion.
		<Animated.View
			className="gap-2 rounded-3xl bg-linear-to-br from-hero-start to-hero-end p-6"
			entering={FadeInDown.duration(400)}
		>
			<AppText className="text-hero-foreground" variant="title">
				{headline}
			</AppText>
			<AppText className="text-hero-foreground/80">{body}</AppText>
		</Animated.View>
	);
}

type EmailCodeViewProps = {
	/** The address that waits for its code: the email of the form, after its check. */
	email: string;
	/**
	 * The password of the form that opened the view, after its check. It stays in memory only.
	 * Supabase accepted it. The view saves it on the account after a right code.
	 */
	formPassword: string;
	/** True when a refused sign-in opened the view. The view then first says why it shows. */
	isAfterRefusedSignIn: boolean;
	/** Goes back to the form. The form keeps the typed email and password. */
	onUseAnotherEmail: () => void;
};

/**
 * The third view of the sign-in screen: the user types the 6-digit code of the
 * sign-up email. After a right code, the view saves the password of the form on the
 * account. Then the session arrives, and the modal closes.
 * The view never says if the address has an account. Supabase sends no email to an
 * address with a confirmed account, and the hint line covers that case.
 */
function EmailCodeView({
	email,
	formPassword,
	isAfterRefusedSignIn,
	onUseAnotherEmail,
}: EmailCodeViewProps) {
	const { t } = useT();
	const [code, setCode] = useState("");
	const [isCodeInvalid, setIsCodeInvalid] = useState(false);
	const { verifyCode, finishSignUp } = useEmailCodeConfirmation(formPassword);
	const resendCode = useResendEmailCode();
	// Each action resets the other one, so only the last answer shows.
	const failure = verifyCode.error ?? resendCode.error;
	// Supabase accepts a code one time. After a right code, the code check must not run again.
	const isCodeAccepted = verifyCode.isSuccess;
	// One call at a time: a reset of a call that runs loses its success callback.
	const isCallRunning =
		verifyCode.isPending || finishSignUp.isPending || resendCode.isPending;

	function submitCode() {
		// The keyboard can submit the field again while a call runs.
		if (isCallRunning) {
			return;
		}
		// A second code check answers `otp_expired`. Only a failed last step runs again.
		if (isCodeAccepted) {
			if (finishSignUp.isError) {
				finishSignUp.mutate(formPassword);
			}
			return;
		}
		const parsed = emailCodeSchema.safeParse({ email, code });
		setIsCodeInvalid(!parsed.success);
		if (parsed.success) {
			resendCode.reset();
			verifyCode.mutate(parsed.data);
		}
	}

	function sendNewCode() {
		// A second press while the call runs must not send a second email.
		// After a right code, Supabase sends nothing, so the call has no use.
		if (isCallRunning || isCodeAccepted) {
			return;
		}
		verifyCode.reset();
		resendCode.mutate(email, {
			// A new email makes the old code stop, so the typed digits go away. A refused
			// call sends no email: the old code stays valid, and the digits stay.
			onSuccess: () => {
				setCode("");
				setIsCodeInvalid(false);
			},
		});
	}

	return (
		<Screen className="gap-5">
			<Stack.Screen options={{ title: t("auth.codeTitle") }} />
			<BrandBlock
				body={t("auth.codeBody", { email })}
				headline={t("auth.codeHeadline")}
			/>
			<AppTextField
				isDisabled={isCodeAccepted}
				isInvalid={isCodeInvalid}
				isRequired
			>
				<AppTextField.Label>{t("auth.code")}</AppTextField.Label>
				{/* iOS can offer the code from the Mail app. Android and the web get the one-time-code hint. */}
				<AppTextField.Input
					autoComplete="one-time-code"
					autoFocus
					keyboardType="number-pad"
					maxLength={EMAIL_CODE_LENGTH}
					onChangeText={setCode}
					onSubmitEditing={submitCode}
					returnKeyType="go"
					textContentType="oneTimeCode"
					value={code}
				/>
				<AppTextField.FieldError>
					{t("auth.errors.code")}
				</AppTextField.FieldError>
			</AppTextField>
			{failure ? (
				<AppText className="text-danger" variant="caption">
					{t(authErrorKey(failure))}
				</AppText>
			) : null}
			{/* The code was right, but the password save or the session failed. "Confirm" runs that step again. */}
			{finishSignUp.isError ? (
				<AppText className="text-danger" variant="caption">
					{t("auth.errors.signUpNotFinished")}
				</AppText>
			) : null}
			{resendCode.isSuccess ? (
				<AppText variant="caption">{t("auth.resendDone")}</AppText>
			) : null}
			{/* The user comes from a refused sign-in. This line says why, until the first call here. */}
			{isAfterRefusedSignIn && verifyCode.isIdle && resendCode.isIdle ? (
				<AppText className="text-danger" variant="caption">
					{t("auth.errors.emailNotConfirmed")}
				</AppText>
			) : null}
			{/* After a right code, the button stays off while the modal closes. Only a failed last step turns it on. */}
			<AppButton
				isDisabled={isCallRunning || (isCodeAccepted && !finishSignUp.isError)}
				onPress={submitCode}
			>
				{t("auth.confirmCode")}
			</AppButton>
			<AppButton
				isDisabled={isCallRunning || isCodeAccepted}
				onPress={sendNewCode}
				variant="ghost"
			>
				{t("auth.resendCode")}
			</AppButton>
			{/* Off while a call runs: the view must stay until the password is saved. */}
			<AppButton
				isDisabled={isCallRunning || isCodeAccepted}
				onPress={onUseAnotherEmail}
				variant="ghost"
			>
				{t("auth.changeEmail")}
			</AppButton>
			<AppText className="text-center" variant="caption">
				{t("auth.codeHint")}
			</AppText>
		</Screen>
	);
}
