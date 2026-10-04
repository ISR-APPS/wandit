/**
 * The top card of the account screen: the avatar, the name, and the email of
 * the signed-in user. It shows a skeleton while the profile loads and a retry
 * button when the read fails. `AccountScreen` renders it.
 */
import { View } from "react-native";
import { useT } from "@/i18n";
import {
	AppAvatar,
	AppButton,
	AppSkeletonGroup,
	AppText,
	initialsOf,
} from "@/shared/ui";
import { useProfile } from "../api/profile.queries";

type ProfileHeaderProps = {
	/** `auth.users.id` of the signed-in user. */
	userId: string;
	/** The sign-in email. It also gives the initials when the name is empty. */
	email: string;
};

/** The avatar, the name, and the email of the signed-in user, with its loading and error states. */
export function ProfileHeader({ userId, email }: ProfileHeaderProps) {
	const { t } = useT();
	const profile = useProfile(userId);

	if (profile.isPending) {
		return <ProfileHeaderSkeleton />;
	}

	if (profile.isError) {
		return (
			<View className="items-start gap-3">
				<AppText variant="caption">{t("common.loadError")}</AppText>
				<AppButton
					onPress={() => profile.refetch()}
					size="sm"
					variant="secondary"
				>
					{t("common.retry")}
				</AppButton>
			</View>
		);
	}

	// A user who never saved a name has no row yet; the email stands in.
	const name = profile.data?.full_name ?? null;
	return (
		<View className="flex-row items-center gap-4">
			<AppAvatar alt={name ?? email} size="lg">
				<AppAvatar.Fallback>{initialsOf(name ?? email)}</AppAvatar.Fallback>
			</AppAvatar>
			<View className="flex-1 gap-1">
				<AppText variant="heading">{name ?? t("profile.noName")}</AppText>
				<AppText variant="caption">{email}</AppText>
			</View>
		</View>
	);
}

/** The loading shape of the header. `AccountScreen` also shows it while the session loads. */
export function ProfileHeaderSkeleton() {
	return (
		<AppSkeletonGroup className="flex-row items-center gap-4" isLoading>
			<AppSkeletonGroup.Item className="size-16 rounded-full" />
			<View className="flex-1 gap-2">
				<AppSkeletonGroup.Item className="h-5 w-40 rounded-md" />
				<AppSkeletonGroup.Item className="h-4 w-56 rounded-md" />
			</View>
		</AppSkeletonGroup>
	);
}
