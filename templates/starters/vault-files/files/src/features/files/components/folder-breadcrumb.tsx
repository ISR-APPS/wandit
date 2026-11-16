// The trail of the open folder: "All files / Brand / Logos". Each step but the last links to its folder.
// FilesPage renders it above the toolbar. It reads the trail that folderTrail builds.
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { FolderRow } from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { CaretRightIcon } from "~/shared/ui/icons";

type FolderBreadcrumbProps = {
	/** The folders from the top folder down to the open one. Empty at the top of the workspace. */
	trail: FolderRow[];
};

/** A nav of links. The open folder is plain text with aria-current. */
export function FolderBreadcrumb({ trail }: FolderBreadcrumbProps) {
	const { t } = useT();
	const steps = [{ id: null, name: t("files.allFiles") }, ...trail];
	return (
		<nav aria-label={t("files.breadcrumb")}>
			<ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
				{steps.map((step, index) => {
					const isLast = index === steps.length - 1;
					return (
						<Fragment key={step.id ?? "top"}>
							<li className="min-w-0">
								{isLast ? (
									<span aria-current="page" className="font-medium" dir="auto">
										{step.name}
									</span>
								) : (
									<Link
										to="/app/files"
										search={(previous) => ({
											...previous,
											folder: step.id ?? undefined,
										})}
										className="text-muted-foreground hover:text-foreground hover:underline"
										dir="auto"
									>
										{step.name}
									</Link>
								)}
							</li>
							{isLast ? null : (
								<li aria-hidden className="text-muted-foreground">
									<CaretRightIcon className="size-3.5 rtl:rotate-180" />
								</li>
							)}
						</Fragment>
					);
				})}
			</ol>
		</nav>
	);
}
