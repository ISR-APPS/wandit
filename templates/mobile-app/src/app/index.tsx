/**
 * Home screen at route "/". It shows the language switch and one HeroUI card,
 * and it links to the example list at "/profiles".
 */
import { Link } from "expo-router";
import { View } from "react-native";
import { localeMeta, locales, useSetLocale, useT } from "@/i18n";
import { AppButton, AppCard, AppText, Screen } from "@/shared/ui";

export default function HomeScreen() {
	const { t, locale } = useT();
	const setLocale = useSetLocale();

	return (
		<Screen>
			<AppText variant="title">{t("home.title")}</AppText>
			<AppText variant="caption">{t("home.subtitle")}</AppText>
			<AppCard>
				<AppCard.Body className="gap-3">
					<AppCard.Title>{t("home.languageTitle")}</AppCard.Title>
					<View className="flex-row flex-wrap gap-2">
						{locales.map((code) => (
							<AppButton
								key={code}
								accessibilityState={{ selected: code === locale }}
								onPress={() => setLocale(code)}
								size="sm"
								variant={code === locale ? "primary" : "secondary"}
							>
								{localeMeta[code].nativeLabel}
							</AppButton>
						))}
					</View>
				</AppCard.Body>
			</AppCard>
			<Link asChild href="/profiles">
				<AppButton variant="outline">{t("home.openProfiles")}</AppButton>
			</Link>
		</Screen>
	);
}
