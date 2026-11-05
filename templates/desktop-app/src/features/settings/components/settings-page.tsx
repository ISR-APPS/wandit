// The settings page: the page header and the business name form. The /settings route renders it.
// It reads and writes the business_name row of app_settings, the example of the data path through src/lib/db.ts.
import { useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import { Skeleton } from "~/shared/ui/skeleton";
import { useSaveSettingMutation } from "../api/settings.mutations";
import { settingQueryOptions } from "../api/settings.queries";

/** The header, then the form, its loading state, or its error state. */
export function SettingsPage() {
	const { t } = useT();
	const businessName = useQuery(settingQueryOptions("business_name"));

	return (
		<div className="grid w-full max-w-md gap-6">
			<PageHeader
				title={t("settings.title")}
				description={t("settings.description")}
			/>
			{businessName.isPending ? (
				<Skeleton className="h-40 w-full" />
			) : businessName.isError ? (
				<div className="grid gap-4">
					<p role="alert">{t("settings.loadError")}</p>
					<Button
						type="button"
						className="justify-self-start"
						onClick={() => businessName.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : (
				<SettingsForm savedName={businessName.data ?? ""} />
			)}
		</div>
	);
}

type SettingsFormProps = {
	/** The saved business name, or "" before the first save. */
	savedName: string;
};

function SettingsForm({ savedName }: SettingsFormProps) {
	const { t } = useT();
	const saveSetting = useSaveSettingMutation();

	function onSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = new FormData(event.currentTarget).get("businessName");
		saveSetting.mutate({
			key: "business_name",
			value: typeof name === "string" ? name.trim() : "",
		});
	}

	return (
		<Card>
			<CardContent>
				<form onSubmit={onSave} className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="settings-business-name">
							{t("settings.businessName")}
						</Label>
						{/* Uncontrolled: the saved name is only the start value, so no state copy. */}
						<Input
							id="settings-business-name"
							name="businessName"
							defaultValue={savedName}
							// 200 characters fit any business name. The home page shows the name as its title.
							maxLength={200}
							onChange={() => saveSetting.reset()}
							placeholder={t("settings.businessNamePlaceholder")}
						/>
					</div>
					{saveSetting.isSuccess && (
						<p className="text-muted-foreground text-sm">
							{t("settings.saved")}
						</p>
					)}
					{saveSetting.isError && (
						<p className="text-destructive text-sm" role="alert">
							{t("settings.saveError")}
						</p>
					)}
					<Button
						type="submit"
						className="justify-self-start"
						disabled={saveSetting.isPending}
					>
						{t("common.save")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
