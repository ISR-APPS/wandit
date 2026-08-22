import type { AffiliatePortalLink } from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import {
	buildAffiliateShareUrl,
	programTermsParts,
} from "../lib/affiliate-portal-format";
import { PortalProgramTerms } from "./portal-program-terms";
import { PortalStatusBadge } from "./portal-status-badge";

type PortalLinksTableProps = {
	items: readonly AffiliatePortalLink[];
};

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
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-4 py-5 sm:px-6">
				<CardTitle>{t("affiliates.links.title")}</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{items.length === 0 ? (
					<Empty className="min-h-56">
						<EmptyHeader>
							<EmptyMedia variant="icon" className="rounded-xl">
								<Link2 aria-hidden />
							</EmptyMedia>
							<EmptyTitle>{t("affiliates.links.empty")}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
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
									<TableRow key={item.link.id}>
										<TableCell className="ps-4 sm:ps-6">
											<p className="font-medium font-mono text-xs">
												<span dir="ltr">{item.link.code}</span>
											</p>
											{item.link.label ? (
												<p className="mt-1 max-w-40 truncate text-muted-foreground text-xs">
													{item.link.label}
												</p>
											) : null}
										</TableCell>
										<TableCell>
											<p className="max-w-48 truncate font-medium text-sm">
												{item.program.name}
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
													<Badge
														variant="outline"
														className="text-muted-foreground"
													>
														{t("affiliates.links.programArchived")}
													</Badge>
												) : null}
											</div>
											{item.link.expiresAt ? (
												<p className="mt-1 text-[11px] text-muted-foreground">
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
											{formatNumber(
												item.aggregates.attributedUserCount,
												locale,
											)}
										</TableCell>
										<TableCell className="text-end font-mono tabular-nums">
											{formatNumber(item.aggregates.paidCustomerCount, locale)}
										</TableCell>
										<TableCell className="pe-4 sm:pe-6">
											<div className="flex min-w-40 items-center gap-2">
												<span
													dir="ltr"
													className="min-w-0 max-w-44 truncate font-mono text-muted-foreground text-xs"
													title={shareUrl}
												>
													{shareUrl}
												</span>
												<Button
													type="button"
													variant="outline"
													size="xs"
													onClick={() => void copyShareLink(shareUrl)}
												>
													<Copy data-icon="inline-start" aria-hidden />
													{t("affiliates.links.copy")}
												</Button>
											</div>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
