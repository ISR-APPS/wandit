// The page behind login: the profile form and the sign-out button.
// The /app route renders it after its guard and its loader; the profile is in the cache.
// The route also uses the skeleton and the error state below.
import type { Session } from "@supabase/supabase-js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useSignOutMutation } from "~/features/auth";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import { Skeleton } from "~/shared/ui/skeleton";
import { useSaveProfileMutation } from "../api/profile.mutations";
import { profileQueryOptions } from "../api/profile.queries";

type ProfilePageProps = {
	/** The signed-in session that the /app route guard returns. */
	session: Session;
};

export function ProfilePage({ session }: ProfilePageProps) {
	const { t } = useT();
	const { data: profile } = useSuspenseQuery(
		profileQueryOptions(session.user.id),
	);
	const saveProfile = useSaveProfileMutation();
	const signOut = useSignOutMutation();

	function onSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const fullName = new FormData(event.currentTarget).get("fullName");
		saveProfile.mutate(typeof fullName === "string" ? fullName : "");
	}

	return (
		<div className="mx-auto max-w-md px-6 py-20">
			<Card>
				<CardHeader>
					<CardTitle>{t("profile.title")}</CardTitle>
					<CardDescription>{session.user.email}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={onSave} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="profile-name">{t("profile.fullName")}</Label>
							{/* Uncontrolled: the saved name is only the start value, so no state copy. */}
							<Input
								id="profile-name"
								name="fullName"
								defaultValue={profile.fullName}
								// 200 is the bound of saveProfileFn.
								maxLength={200}
								onChange={() => saveProfile.reset()}
								placeholder={t("profile.fullNamePlaceholder")}
							/>
						</div>
						{saveProfile.isSuccess && (
							<p className="text-muted-foreground text-sm">
								{t("profile.saved")}
							</p>
						)}
						{saveProfile.isError && (
							<p className="text-destructive text-sm" role="alert">
								{t("profile.saveError")}
							</p>
						)}
						{signOut.isError && (
							<p className="text-destructive text-sm" role="alert">
								{t("profile.signOutError")}
							</p>
						)}
						<div className="flex items-center justify-between gap-2">
							<Button type="submit" disabled={saveProfile.isPending}>
								{t("common.save")}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={signOut.isPending}
								onClick={() => signOut.mutate()}
							>
								{t("common.signOut")}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

/** Placeholder while the /app guard and loader run. The route sets it as pendingComponent. */
export function ProfilePageSkeleton() {
	return (
		<div className="mx-auto max-w-md px-6 py-20">
			<Skeleton className="h-40 w-full" />
		</div>
	);
}

/** Error state of /app when the loader fails. Retry runs the guard and the loader again. */
export function ProfilePageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="mx-auto grid max-w-md gap-4 px-6 py-20 text-center">
			<p role="alert">{t("profile.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
