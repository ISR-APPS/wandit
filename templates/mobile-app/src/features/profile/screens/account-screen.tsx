/**
 * Account tab at route "/account". In every state it shows the language list.
 * Signed out, it invites the user to the sign-in modal. Signed in, it also
 * shows the profile, a link to the edit screen in the same stack, and sign-out.
 */
import { Link } from "expo-router";
import { useSession, useSignOut } from "@/features/auth";
import { LanguagePicker, useT } from "@/i18n";
import {
	AppButton,
	AppIcon,
	AppListGroup,
	AppText,
	EmptyState,
	Screen,
} from "@/shared/ui";
import {
	ProfileHeader,
	ProfileHeaderSkeleton,
} from "../components/profile-header";

/** The account tab root. It renders one of three states from `useSession()`. */
export function AccountScreen() {
	const { t } = useT();
	const session = useSession();
	const signOut = useSignOut();

	return (
		<Screen className="gap-6">
			<AppText variant="title">{t("account.title")}</AppText>
			{/* A saved session is the usual case, so the wait shows the signed-in shape. */}
			{session.status === "loading" ? <ProfileHeaderSkeleton /> : null}
			{session.status === "signed-out" ? (
				<EmptyState
					action={
						<Link asChild href="/sign-in">
							<AppButton>{t("auth.signIn")}</AppButton>
						</Link>
					}
					description={t("account.signedOutBody")}
					icon="person-circle-outline"
					title={t("account.signedOutTitle")}
				/>
			) : null}
			{session.status === "signed-in" ? (
				<>
					<ProfileHeader
						email={session.session.user.email ?? ""}
						userId={session.session.user.id}
					/>
					<AppListGroup>
						<Link asChild href="/account/edit-profile">
							<AppListGroup.Item>
								<AppListGroup.ItemPrefix>
									<AppIcon
										colorClassName="accent-muted"
										name="person-outline"
										size={22}
									/>
								</AppListGroup.ItemPrefix>
								<AppListGroup.ItemContent>
									<AppListGroup.ItemTitle>
										{t("account.editProfile")}
									</AppListGroup.ItemTitle>
									<AppListGroup.ItemDescription>
										{t("account.editProfileHint")}
									</AppListGroup.ItemDescription>
								</AppListGroup.ItemContent>
								<AppListGroup.ItemSuffix />
							</AppListGroup.Item>
						</Link>
					</AppListGroup>
				</>
			) : null}
			<LanguagePicker />
			{session.status === "signed-in" ? (
				<>
					{signOut.isError ? (
						<AppText className="text-danger" variant="caption">
							{t("account.signOutError")}
						</AppText>
					) : null}
					<AppButton
						isDisabled={signOut.isPending}
						onPress={() => signOut.mutate()}
						variant="danger-soft"
					>
						{t("auth.signOut")}
					</AppButton>
				</>
			) : null}
		</Screen>
	);
}
