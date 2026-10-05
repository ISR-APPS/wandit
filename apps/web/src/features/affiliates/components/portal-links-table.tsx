/**
 * The "Links" tab of the affiliate portal: one row per referral link, with
 * its program terms, status, counts, and a copy button for the share URL.
 * The portal page renders it with the links of the overview answer.
 * The copy button writes to the clipboard and shows a toast.
 */
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import type { AffiliatePortalLink } from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import {
	buildAffiliateShareUrl,
	programTermsParts,
} from "../lib/affiliate-portal-format";
import { PortalProgramTerms } from "./portal-program-terms";
import { PortalStatusBadge } from "./portal-status-badge";
import {
	PORTAL_TABLE_HEADER_CLASS,
	PORTAL_TABLE_ROW_CLASS,
	PortalTableCard,
	PortalTableEmpty,
} from "./portal-table-states";

type PortalLinksTableProps = {
	items: readonly AffiliatePortalLink[];
};

/** The links table. It has no pager: the overview answer holds every link of the affiliate. */
export function PortalLinksTable({ items }: PortalLinksTableProps) {
	const { locale, t } = useTranslation();
	const origin = typeof window === "undefined" ? "" : window.location.origin;

	const copyShareLink = async (shareUrl: string) => {
		try {
			if (!navigator.clipboard) {
				throw new Error("Clipboard API unavailable");
			}

			await navigator.clipboard.writeText(shareUrl);
			toast.success(t("affiliates.links.copied"));
		} catch {
			toast.error(t("affiliates.links.copyFailed"));
		}
	};

	return (
		<PortalTableCard title={t("affiliates.links.title")}>
			{items.length === 0 ? (
				<PortalTableEmpty
					icon={LinkSimpleIcon}
					title={t("affiliates.links.empty")}
				/>
			) : (
				<Table>
					<TableHeader className={PORTAL_TABLE_HEADER_CLASS}>
						<TableRow className="hover:bg-transparent">
							<TableHead className="ps-4 sm:ps-6">
								{t("affiliates.links.code")}
							</TableHead>
							<TableHead>{t("affiliates.links.program")}</TableHead>
							<TableHead>{t("affiliates.links.status")}</TableHead>
							<TableHead className="text-end">
								{t("affiliates.links.clicks")}
							</TableHead>
							<TableHead className="text-end">
								{t("affiliates.links.signups")}
							</TableHead>
							<TableHead className="text-end">
								{t("affiliates.links.paying")}
							</TableHead>
							<TableHead className="pe-4 sm:pe-6">
								{t("affiliates.links.shareLink")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => {
							const shareUrl = buildAffiliateShareUrl(
								origin,
								item.link.landingPath,
								item.link.code,
							);

							return (
								<TableRow key={item.link.id} className={PORTAL_TABLE_ROW_CLASS}>
									<TableCell className="ps-4 sm:ps-6">
										<p className="font-medium font-mono text-night text-xs dark:text-foreground">
											<span dir="ltr">{item.link.code}</span>
										</p>
										{item.link.label ? (
											<p className="mt-1 max-w-40 truncate text-night/60 text-xs dark:text-foreground/60">
												{/* bdi keeps the label in its own direction; the line follows the page side. */}
												<bdi>{item.link.label}</bdi>
											</p>
										) : null}
									</TableCell>
									<TableCell>
										<p className="max-w-48 truncate font-grotesk font-semibold text-night text-sm dark:text-foreground">
											<bdi>{item.program.name}</bdi>
										</p>
										<PortalProgramTerms
											parts={programTermsParts(item.program)}
											className="mt-1 block max-w-56 whitespace-normal"
										/>
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap items-center gap-1.5">
											<PortalStatusBadge
												kind="link"
												status={item.link.status}
											/>
											{item.program.status !== "active" ? (
												<span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-night/[0.06] px-2.5 font-grotesk font-semibold text-[11px] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70">
													{t("affiliates.links.programArchived")}
												</span>
											) : null}
										</div>
										{item.link.expiresAt ? (
											<p className="mt-1 text-[11px] text-night/60 dark:text-foreground/60">
												{t("affiliates.links.expires", {
													date: formatDate(item.link.expiresAt, locale, {
														dateStyle: "short",
													}),
												})}
											</p>
										) : null}
									</TableCell>
									<TableCell className="text-end font-mono tabular-nums">
										{formatNumber(item.aggregates.clickCount, locale)}
									</TableCell>
									<TableCell className="text-end font-mono tabular-nums">
										{formatNumber(item.aggregates.attributedUserCount, locale)}
									</TableCell>
									<TableCell className="text-end font-mono tabular-nums">
										{formatNumber(item.aggregates.paidCustomerCount, locale)}
									</TableCell>
									<TableCell className="pe-4 sm:pe-6">
										<div className="flex min-w-40 items-center gap-1">
											<span
												dir="ltr"
												className="min-w-0 max-w-44 truncate font-mono text-night/60 text-xs dark:text-foreground/60"
												title={shareUrl}
											>
												{shareUrl}
											</span>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label={t("affiliates.links.copy")}
												title={t("affiliates.links.copy")}
												onClick={() => void copyShareLink(shareUrl)}
												className="rounded-full text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06]"
											>
												<CopyIcon
													aria-hidden
													weight="bold"
													className="size-4"
												/>
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}
		</PortalTableCard>
	);
}
