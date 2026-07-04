import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

import { PromptBox } from "../components/prompt-box";

export function HomeScreen() {
	const { t } = useTranslation();

	function handleSubmit(_prompt: string) {
		// TODO: create the project via the API with the first prompt, then
		// land in the workspace with generation already streaming (PRD §3).
		router.push("/project/demo-project");
	}

	return (
		<Container className="p-6" isScrollable={false}>
			<View className="flex-1 justify-center gap-8 pb-24">
				<Text className="text-center font-bold text-3xl text-foreground">
					{t("native.home.heading")}
				</Text>
				<PromptBox onSubmit={handleSubmit} />
			</View>
		</Container>
	);
}
