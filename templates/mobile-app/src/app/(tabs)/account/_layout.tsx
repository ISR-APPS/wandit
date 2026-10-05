/**
 * The stack of the account tab: the account screen, then the edit screen
 * pushed with a native header and a back button. Only a signed-in user can
 * open the edit screen.
 */
import { Stack } from "expo-router";
import { useSession } from "@/features/auth";
import { useT } from "@/i18n";

// A web visitor can open "/account/edit-profile" first; the account screen then sits below it.
export const unstable_settings = { anchor: "index" };

export default function AccountStackLayout() {
	const { t } = useT();
	const session = useSession();
	return (
		<Stack>
			{/* The tab root draws its own large title, so it hides the header. */}
			<Stack.Screen
				name="index"
				options={{ headerShown: false, title: t("tabs.account") }}
			/>
			{/* After a sign-out, the edit screen closes and the account screen shows.
			    The route stays while the session loads, so a cold open of the form works. */}
			<Stack.Protected guard={session.status !== "signed-out"}>
				<Stack.Screen
					name="edit-profile"
					options={{ title: t("profile.editTitle") }}
				/>
			</Stack.Protected>
		</Stack>
	);
}
