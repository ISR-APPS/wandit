/**
 * Screen for a `/templates/$templateId` URL whose id is not in the catalog.
 * The route file renders it as `notFoundComponent`, inside the dashboard shell.
 */
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { LayoutIcon } from "@phosphor-icons/react/Layout";
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";

import { DashboardShell } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";

/** The dashed frame of the dashboard empty state, with a link back to the list. */
export function StarterTemplateNotFound() {
	const { t } = useTranslation();

	return (
		<DashboardShell titleKey="templates.title">
			<div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 md:px-6">
				<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
					<span
						aria-hidden
						className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
					>
						<LayoutIcon weight="fill" className="size-7 text-spark" />
					</span>
					<h2 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] rtl:tracking-normal dark:text-foreground">
						{t("templates.notFound.title")}
					</h2>
					<Button
						asChild
						variant="outline"
						size="sm"
						className="mt-6 rounded-full font-grotesk"
					>
						<Link to="/templates">
							<ArrowLeftIcon
								aria-hidden
								weight="bold"
								className="size-4 rtl:-scale-x-100"
							/>
							{t("templates.detail.back")}
						</Link>
					</Button>
				</div>
			</div>
		</DashboardShell>
	);
}
