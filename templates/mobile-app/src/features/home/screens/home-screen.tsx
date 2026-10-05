/**
 * Home tab at route "/": the first screen of the app. It greets the user by
 * name and points to the account tab. The agent replaces it with the real
 * first screen of the app. It reads the profile through the profile barrel.
 */
import { View } from "react-native";
import { useSession } from "@/features/auth";
import { useProfile } from "@/features/profile";
import { useT } from "@/i18n";
import { AppCard, AppSkeleton, AppText, Screen } from "@/shared/ui";

/** The home tab root. It waits for the session before it picks the greeting and the card text. */
export function HomeScreen() {
	const { t } = useT();
	const session = useSession();
	const userId =
		session.status === "signed-in" ? session.session.user.id : null;
	const profile = useProfile(userId);
	// A signed-in user must not see the signed-out text while the session loads.
	const isLoading = session.status === "loading" || profile.isLoading;
	// The query logs a failed read, and the account tab shows the retry.
	// Here a failed read only falls back to the plain welcome.
	const name = profile.data?.full_name ?? null;

	return (
		<Screen className="gap-6">
			<View className="gap-1">
				{isLoading ? (
					<AppSkeleton className="h-9 w-48 rounded-lg" />
				) : (
					<AppText variant="title">
						{name === null ? t("home.title") : t("home.greeting", { name })}
					</AppText>
				)}
				<AppText variant="caption">{t("home.subtitle")}</AppText>
			</View>
			<AppCard>
				<AppCard.Body className="gap-3">
					<AppCard.Title>{t("home.accountTitle")}</AppCard.Title>
					{isLoading ? (
						<AppSkeleton className="h-5 w-full rounded-md" />
					) : (
						<AppCard.Description>
							{session.status === "signed-in"
								? t("home.accountSignedIn")
								: t("home.accountSignedOut")}
						</AppCard.Description>
					)}
				</AppCard.Body>
			</AppCard>
		</Screen>
	);
}
