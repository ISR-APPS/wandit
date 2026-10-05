/**
 * Home tab at route "/": the first screen of the app. It greets the user by
 * name in a hero block and points to the account tab. The agent replaces it with
 * the real first screen of the app. It reads the profile through the profile barrel.
 */
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSession } from "@/features/auth";
import { useProfile } from "@/features/profile";
import { useT } from "@/i18n";
import { AppCard, AppSkeleton, AppText, Screen } from "@/shared/ui";

/** The home tab root. It waits for the session before it picks the greeting and the card text. */
export function HomeScreen() {
	const { t, locale } = useT();
	const session = useSession();
	const userId =
		session.status === "signed-in" ? session.session.user.id : null;
	const profile = useProfile(userId);
	// A signed-in user must not see the signed-out text while the session loads.
	const isLoading = session.status === "loading" || profile.isLoading;
	// The query logs a failed read, and the account tab shows the retry.
	// Here a failed read only falls back to the plain welcome.
	const name = profile.data?.full_name ?? null;
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date());

	return (
		<Screen className="gap-6">
			{/* The hero: the world gradient and the display face. Reanimated skips the
			    entry when the system asks for reduced motion. */}
			<Animated.View
				className="gap-2 rounded-3xl bg-linear-to-br from-hero-start to-hero-end p-6"
				entering={FadeInDown.duration(450)}
			>
				<AppText className="text-hero-foreground/80" variant="caption">
					{today}
				</AppText>
				{isLoading ? (
					<AppSkeleton className="h-12 w-56 rounded-xl" />
				) : (
					<AppText className="text-hero-foreground" variant="display">
						{name === null ? t("home.title") : t("home.greeting", { name })}
					</AppText>
				)}
				<AppText className="text-hero-foreground/80">
					{t("home.subtitle")}
				</AppText>
			</Animated.View>
			<Animated.View entering={FadeInDown.duration(450).delay(120)}>
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
			</Animated.View>
		</Screen>
	);
}
