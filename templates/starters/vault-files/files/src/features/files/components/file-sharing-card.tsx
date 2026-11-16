// Who can open a file from outside the team: each share with its audience, access, state, and views.
// FileDetailPage renders it in the rail. It reads the shares of buildFileDetail, expired ones included.
import { LockSimpleIcon } from "@phosphor-icons/react";
import {
	fillCount,
	formatRelativeTime,
	pluralForm,
	SHARE_ACCESS_BADGE,
	SHARE_STATUS_BADGE,
	ShareAudience,
	type ShareItem,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type FileSharingCardProps = {
	/** Every share of the file, newest first. */
	shares: ShareItem[];
};

/** One block per share. A file with no share says that only the team sees it. */
export function FileSharingCard({ shares }: FileSharingCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.sharing.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				{shares.length === 0 ? (
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						<LockSimpleIcon className="size-4 shrink-0" />
						{t("files.sharing.teamOnly")}
					</p>
				) : (
					<ul className="grid gap-4">
						{shares.map((share) => (
							<li
								key={share.id}
								className="grid gap-2 border-b pb-4 text-sm last:border-b-0 last:pb-0"
							>
								<ShareAudience share={share} />
								<div className="flex flex-wrap items-center gap-1.5">
									<Badge variant={SHARE_STATUS_BADGE[share.status]}>
										{t(`shares.statuses.${share.status}`)}
									</Badge>
									<Badge variant={SHARE_ACCESS_BADGE[share.access]}>
										{t(`shares.access.${share.access}`)}
									</Badge>
								</div>
								<p className="text-muted-foreground text-xs tabular-nums">
									{[
										fillCount(
											t(`shares.viewCount.${pluralForm(share.views, locale)}`),
											share.views,
											locale,
										),
										share.expiresAt === null
											? t("shares.noExpiry")
											: `${t(share.status === "expired" ? "shares.expired" : "shares.expires")} ${formatRelativeTime(share.expiresAt, now, locale)}`,
										`${t("shares.by")} ${share.sharedByName}`,
									].join(" · ")}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
