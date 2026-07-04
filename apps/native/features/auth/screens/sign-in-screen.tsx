import { useTranslation } from "@wandit/internationalization/react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

import { SignInForm } from "../components/sign-in-form";
import { SignUpForm } from "../components/sign-up-form";

// TODO: replace the email/password forms with the real auth methods
// for mobile (Google OAuth + magic link fallback, PRD §3).
export function SignInScreen() {
	const { t } = useTranslation();

	return (
		<Container className="p-6">
			<View className="flex-1 justify-center gap-6 py-10">
				<View className="items-center gap-2">
					<Text className="font-bold text-4xl text-foreground">Wandit</Text>
					<Text className="text-center text-muted text-sm">
						{t("native.auth.tagline")}
					</Text>
				</View>
				<SignInForm />
				<SignUpForm />
			</View>
		</Container>
	);
}
