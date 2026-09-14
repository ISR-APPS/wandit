/**
 * Screen for an `/app/$projectId` URL with no project behind it.
 * Rendered by the route file as `notFoundComponent`, and by
 * pages/app-builder-page.tsx when the project query returns null.
 */

import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";

export function AppNotFound() {
	const { t } = useTranslation();
	return (
		<div className="grid h-svh place-items-center bg-background">
			<div className="flex flex-col items-center gap-3 text-center">
				<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
					<Spark className="size-4 text-primary/60" />
				</span>
				<h1 className="font-display font-semibold text-xl">
					{t("appBuilder.notFound.title")}
				</h1>
				<p className="text-muted-foreground text-sm">
					{t("appBuilder.notFound.body")}
				</p>
				<Button asChild variant="secondary" className="mt-2">
					<Link to="/dashboard">{t("appBuilder.notFound.cta")}</Link>
				</Button>
			</div>
		</div>
	);
}
