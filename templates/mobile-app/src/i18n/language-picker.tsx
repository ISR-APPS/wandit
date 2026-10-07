/**
 * The language list of the account screen. It renders nothing while the app
 * has one language, so it appears by itself when a second code joins `locales`.
 * A press calls `setLocale`, which also mirrors the app for Arabic.
 */
import { View } from "react-native";
import { tapFeedback } from "@/shared/lib/haptics";
import { AppIcon, AppListGroup, AppText } from "@/shared/ui";
import { localeMeta, locales } from "./config";
import { setLocale, useT } from "./provider";

/** Renders null while `locales` has one code. A press saves the locale and can reload the app. */
export function LanguagePicker() {
	const { t, locale } = useT();
	if (locales.length < 2) {
		return null;
	}
	return (
		<View className="gap-2">
			<AppText variant="heading">{t("account.language")}</AppText>
			<AppListGroup>
				{locales.map((code) => (
					<AppListGroup.Item
						accessibilityRole="radio"
						accessibilityState={{ checked: code === locale }}
						key={code}
						onPress={() => {
							tapFeedback();
							setLocale(code);
						}}
					>
						<AppListGroup.ItemContent>
							<AppListGroup.ItemTitle>
								{localeMeta[code].nativeLabel}
							</AppListGroup.ItemTitle>
						</AppListGroup.ItemContent>
						{code === locale ? (
							<AppIcon
								colorClassName="accent-accent"
								name="checkmark"
								size={20}
							/>
						) : null}
					</AppListGroup.Item>
				))}
			</AppListGroup>
		</View>
	);
}
