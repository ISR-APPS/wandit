/**
 * The stack of the home tab. A detail screen of this section is one more
 * file in this folder, pushed with a native header and a back button.
 */
import { Stack } from "expo-router";
import { useT } from "@/i18n";

// A web visitor can open a pushed screen first; the tab root then sits below it.
export const unstable_settings = { anchor: "index" };

export default function HomeStackLayout() {
	const { t } = useT();
	return (
		<Stack>
			{/* The tab root draws its own large title, so it hides the header. */}
			<Stack.Screen
				name="index"
				options={{ headerShown: false, title: t("tabs.home") }}
			/>
		</Stack>
	);
}
