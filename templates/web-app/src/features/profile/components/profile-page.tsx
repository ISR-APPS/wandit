// The profile page behind login: the page header and the profile form.
// The /app/profile route renders it inside the app shell, after its loader; the profile is in the cache.
// The route also uses the skeleton and the error state below. Sign-out lives in the sidebar user menu.
import type { Session } from "@supabase/supabase-js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import { Skeleton } from "~/shared/ui/skeleton";
import { useSaveProfileMutation } from "../api/profile.mutations";
import { profileQueryOptions } from "../api/profile.queries";

type ProfilePageProps = {
	/** The signed-in session that the /app layout guard returns. */
	session: Session;
};

/** The page header with the email, then the name form. The /app/profile route renders it. */
export function ProfilePage({ session }: ProfilePageProps) {
	const { t } = useT();
	const { data: profile } = useSuspenseQuery(
		profileQueryOptions(session.user.id),
	);
	const saveProfile = useSaveProfileMutation();

	function onSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const fullName = new FormData(event.currentTarget).get("fullName");
		saveProfile.mutate(typeof fullName === "string" ? fullName : "");
	}

	return (
		<div className="grid w-full max-w-md gap-6">
			<PageHeader title={t("profile.title")} description={session.user.email} />
			<Card>
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
						<Button
							type="submit"
							className="justify-self-start"
							disabled={saveProfile.isPending}
						>
							{t("common.save")}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}

/** Placeholder while the profile loader runs. The route sets it as pendingComponent. */
export function ProfilePageSkeleton() {
	return (
		<div className="grid w-full max-w-md gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-56" />
			</div>
			<Skeleton className="h-40 w-full" />
		</div>
	);
}

/** Error state of /app/profile when the loader fails. Retry runs the guard and the loader again. */
export function ProfilePageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid w-full max-w-md gap-4">
			<p role="alert">{t("profile.loadError")}</p>
			<Button
				type="button"
				className="justify-self-start"
				onClick={() => router.invalidate()}
			>
				{t("common.retry")}
			</Button>
		</div>
	);
}
