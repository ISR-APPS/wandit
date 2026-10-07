/**
 * Edit screen at route "/account/edit-profile", pushed in the account stack.
 * It reads the profile, fills the form, saves the name with a mutation, and
 * goes back. The account layout lets only a signed-in user open it.
 */
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSession } from "@/features/auth";
import { useT } from "@/i18n";
import { successFeedback } from "@/shared/lib/haptics";
import {
	AppButton,
	AppSkeleton,
	AppText,
	AppTextField,
	Screen,
} from "@/shared/ui";
import { useSaveProfile } from "../api/profile.mutations";
import { useProfile } from "../api/profile.queries";
import { profileFormSchema } from "../lib/profile.schemas";

/** The route screen. It renders nothing until the session is signed in. */
export function EditProfileScreen() {
	const session = useSession();
	// Stack.Protected in the account layout keeps signed-out users out of this route.
	if (session.status !== "signed-in") {
		return null;
	}
	return <EditProfileLoader userId={session.session.user.id} />;
}

/** Waits for the profile, then gives the saved name to the form. */
function EditProfileLoader({ userId }: { userId: string }) {
	const { t } = useT();
	const profile = useProfile(userId);

	if (profile.isPending) {
		// The same shape as the form below: the label, the field, and the button.
		return (
			<Screen className="gap-5">
				<View className="gap-1.5">
					<AppSkeleton className="h-6 w-24 rounded-md" />
					<AppSkeleton className="h-12 w-full rounded-xl" />
				</View>
				<AppSkeleton className="h-12 w-full rounded-full" />
			</Screen>
		);
	}
	if (profile.isError) {
		return (
			<Screen>
				<AppText variant="caption">{t("common.loadError")}</AppText>
				<AppButton onPress={() => profile.refetch()} variant="secondary">
					{t("common.retry")}
				</AppButton>
			</Screen>
		);
	}
	// The form copies the name once. The key gives a fresh form for another row, with no effect.
	return (
		<EditProfileForm
			initialName={profile.data?.full_name ?? ""}
			key={profile.data?.id ?? "new"}
			userId={userId}
		/>
	);
}

type EditProfileFormProps = {
	/** `auth.users.id` of the signed-in user: the id of the profile row. */
	userId: string;
	/** The saved name, or "" when the user has no profile row yet. */
	initialName: string;
};

function EditProfileForm({ userId, initialName }: EditProfileFormProps) {
	const { t } = useT();
	const [fullName, setFullName] = useState(initialName);
	const [isInvalid, setIsInvalid] = useState(false);
	const save = useSaveProfile();

	function submit() {
		// The keyboard can submit the field again while the save runs.
		if (save.isPending) {
			return;
		}
		const parsed = profileFormSchema.safeParse({ fullName });
		if (!parsed.success) {
			setIsInvalid(true);
			return;
		}
		setIsInvalid(false);
		save.mutate(
			{ userId, fullName: parsed.data.fullName },
			{
				onSuccess: () => {
					successFeedback();
					// A web visitor can open this route first; then no screen is behind it.
					if (router.canGoBack()) {
						router.back();
					} else {
						router.replace("/account");
					}
				},
			},
		);
	}

	return (
		<Screen className="gap-5">
			<AppTextField isInvalid={isInvalid} isRequired>
				<AppTextField.Label>{t("profile.nameLabel")}</AppTextField.Label>
				<AppTextField.Input
					autoComplete="name"
					autoFocus
					onChangeText={setFullName}
					onSubmitEditing={submit}
					placeholder={t("profile.namePlaceholder")}
					returnKeyType="done"
					textContentType="name"
					value={fullName}
				/>
				<AppTextField.FieldError>
					{t("profile.nameError")}
				</AppTextField.FieldError>
			</AppTextField>
			{save.isError ? (
				<AppText className="text-danger" variant="caption">
					{t("profile.saveError")}
				</AppText>
			) : null}
			<AppButton isDisabled={save.isPending} onPress={submit}>
				{t("common.save")}
			</AppButton>
		</Screen>
	);
}
