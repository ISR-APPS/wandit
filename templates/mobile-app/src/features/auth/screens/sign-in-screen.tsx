/**
 * Sign-in modal at route "/sign-in": sign in or create an account with email
 * and password, under a brand block in the colors of the design world. The root
 * layout guards the route with Stack.Protected, so the modal closes by itself
 * when the session arrives.
 */
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { z } from "zod";
import { useT } from "@/i18n";
import { AppButton, AppText, AppTextField, Screen } from "@/shared/ui";
import { authErrorKey, useSignIn, useSignUp } from "../api/auth.mutations";
import { signInSchema, signUpSchema } from "../lib/auth.schemas";

/** The field names of the last failed zod check; a missing field passed. */
type FieldErrors = Partial<
	Record<"email" | "password" | "confirmPassword", string[]>
>;

/** One form for sign-in and sign-up. A failed call shows a translated error, never the raw text. */
export function SignInScreen() {
	const { t } = useT();
	const [isSignUp, setIsSignUp] = useState(false);
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

	return (
		<Screen className="gap-5">
			{/* The modal header shows the title of the current mode. */}
			<Stack.Screen
				options={{
					title: isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle"),
				}}
			/>
			{/* The brand block: the hero gradient of the world. Reanimated skips the
			    entry when the system asks for reduced motion. */}
			<Animated.View
				className="gap-2 rounded-3xl bg-linear-to-br from-hero-start to-hero-end p-6"
				entering={FadeInDown.duration(400)}
			>
				<AppText className="text-hero-foreground" variant="title">
					{isSignUp ? t("auth.signUpHeadline") : t("auth.signInHeadline")}
				</AppText>
				<AppText className="text-hero-foreground/80">
					{t("auth.headlineBody")}
				</AppText>
			</Animated.View>
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
