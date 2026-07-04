import { useForm } from "@tanstack/react-form";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import {
	Button,
	FieldError,
	Input,
	Label,
	Spinner,
	Surface,
	TextField,
	useToast,
} from "heroui-native";
import { useMemo, useRef } from "react";
import { Text, type TextInput, View } from "react-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";

type Translate = ReturnType<typeof useTranslation>["t"];

function makeSignUpSchema(t: Translate) {
	return z.object({
		name: z
			.string()
			.trim()
			.min(1, t("native.auth.validation.nameRequired"))
			.min(2, t("native.auth.validation.nameMin")),
		email: z
			.string()
			.trim()
			.min(1, t("native.auth.validation.emailRequired"))
			.email(t("native.auth.validation.emailInvalid")),
		password: z
			.string()
			.min(1, t("native.auth.validation.passwordRequired"))
			.min(8, t("native.auth.validation.passwordMin")),
	});
}

function getErrorMessage(error: unknown): string | null {
	if (!error) return null;

	if (typeof error === "string") {
		return error;
	}

	if (Array.isArray(error)) {
		for (const issue of error) {
			const message = getErrorMessage(issue);
			if (message) {
				return message;
			}
		}
		return null;
	}

	if (typeof error === "object" && error !== null) {
		const maybeError = error as { message?: unknown };
		if (typeof maybeError.message === "string") {
			return maybeError.message;
		}
	}

	return null;
}

export function SignUpForm() {
	const emailInputRef = useRef<TextInput>(null);
	const passwordInputRef = useRef<TextInput>(null);
	const { toast } = useToast();
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const signUpSchema = useMemo(() => makeSignUpSchema(t), [t]);

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
		},
		validators: {
			onSubmit: signUpSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			await authClient.signUp.email(
				{
					name: value.name.trim(),
					email: value.email.trim(),
					password: value.password,
				},
				{
					onError(error) {
						const code = error.error?.code;
						const codeMessage =
							code && Object.hasOwn(dictionary.errors.codes, code)
								? t(`errors.codes.${code}` as Parameters<Translate>[0])
								: null;
						toast.show({
							variant: "danger",
							label:
								codeMessage ??
								t("native.auth.toasts.signUpError") ??
								error.error?.message,
						});
					},
					onSuccess() {
						formApi.reset();
						toast.show({
							variant: "success",
							label: t("native.auth.toasts.signUpSuccess"),
						});
					},
				},
			);
		},
	});

	return (
		<Surface variant="secondary" className="rounded-lg p-4">
			<Text className="mb-4 font-medium text-foreground">
				{t("native.auth.signUp.title")}
			</Text>

			<form.Subscribe
				selector={(state) => ({
					isSubmitting: state.isSubmitting,
					validationError: getErrorMessage(state.errorMap.onSubmit),
				})}
			>
				{({ isSubmitting, validationError }) => {
					const formError = validationError;

					return (
						<>
							<FieldError isInvalid={!!formError} className="mb-3">
								{formError}
							</FieldError>

							<View className="gap-3">
								<form.Field name="name">
									{(field) => (
										<TextField>
											<Label>{t("native.auth.fields.nameLabel")}</Label>
											<Input
												value={field.state.value}
												onBlur={field.handleBlur}
												onChangeText={field.handleChange}
												placeholder={t("native.auth.fields.namePlaceholder")}
												autoComplete="name"
												textContentType="name"
												returnKeyType="next"
												blurOnSubmit={false}
												onSubmitEditing={() => {
													emailInputRef.current?.focus();
												}}
											/>
										</TextField>
									)}
								</form.Field>

								<form.Field name="email">
									{(field) => (
										<TextField>
											<Label>{t("native.auth.fields.emailLabel")}</Label>
											<Input
												ref={emailInputRef}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChangeText={field.handleChange}
												placeholder={t("native.auth.fields.emailPlaceholder")}
												keyboardType="email-address"
												autoCapitalize="none"
												autoComplete="email"
												textContentType="emailAddress"
												returnKeyType="next"
												blurOnSubmit={false}
												onSubmitEditing={() => {
													passwordInputRef.current?.focus();
												}}
											/>
										</TextField>
									)}
								</form.Field>

								<form.Field name="password">
									{(field) => (
										<TextField>
											<Label>{t("native.auth.fields.passwordLabel")}</Label>
											<Input
												ref={passwordInputRef}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChangeText={field.handleChange}
												placeholder={t(
													"native.auth.fields.passwordPlaceholder",
												)}
												secureTextEntry
												autoComplete="new-password"
												textContentType="newPassword"
												returnKeyType="go"
												onSubmitEditing={form.handleSubmit}
											/>
										</TextField>
									)}
								</form.Field>

								<Button
									onPress={form.handleSubmit}
									isDisabled={isSubmitting}
									className="mt-1"
								>
									{isSubmitting ? (
										<Spinner size="sm" color="default" />
									) : (
										<Button.Label>
											{t("native.auth.signUp.submit")}
										</Button.Label>
									)}
								</Button>
							</View>
						</>
					);
				}}
			</form.Subscribe>
		</Surface>
	);
}
