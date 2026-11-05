// The home page. The "/" route renders it. It shows the business name of the settings,
// or an empty state that leads to the settings page. The app replaces it with its own home.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { settingQueryOptions } from "~/features/settings";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

/** The page header with the business name, its loading and error states, and the empty state. */
export function HomePage() {
	const { t } = useT();
	const businessName = useQuery(settingQueryOptions("business_name"));

	if (businessName.isPending) {
		return <Skeleton className="h-8 w-56" />;
	}
	if (businessName.isError) {
		return (
			<div className="grid gap-4">
				<p role="alert">{t("home.loadError")}</p>
				<Button
					type="button"
					className="justify-self-start"
					onClick={() => businessName.refetch()}
				>
					{t("common.retry")}
				</Button>
			</div>
		);
	}
	if (!businessName.data) {
		return (
			<>
				<PageHeader title={t("home.title")} />
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle>{t("home.emptyTitle")}</CardTitle>
						<CardDescription>{t("home.emptyBody")}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/settings">{t("home.emptyAction")}</Link>
						</Button>
					</CardContent>
				</Card>
			</>
		);
	}
	return <PageHeader title={businessName.data} />;
}
