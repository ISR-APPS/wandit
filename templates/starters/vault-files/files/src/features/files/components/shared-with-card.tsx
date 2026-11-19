// The "People with access" card of the file page: each live share (a public link or an invited contact),
// then each team member who uploaded a version. FileDetailPage renders it beside the version table.
// A person row has a mailto button; a link row opens the Shared page. The header button opens the Shared page too.
import { GlobeSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	type ContactRow,
	MemberAvatar,
	type MemberRow,
	type ShareItem,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";

type SharedWithCardProps = {
	/** Every share of the file, expired ones too. The card lists the live ones. */
	shares: ShareItem[];
	/** Team members who uploaded a version, newest upload first. From FileDetail.editors. */
	editors: MemberRow[];
};

/** One row of the card: a public link, an invited contact of a share, or a team editor. */
type AccessRow =
	| { key: string; kind: "link"; share: ShareItem }
	| { key: string; kind: "contact"; share: ShareItem; contact: ContactRow }
	| { key: string; kind: "editor"; member: MemberRow };

// The card shows five rows, as the kit connection list does. The Shared page lists the other shares.
const SHOWN_ROWS = 5;

/** Live shares come first, because they reach people outside the team. A file with none says so in one line. */
export function SharedWithCard({ shares, editors }: SharedWithCardProps) {
	const { t } = useT();
	const shareRows = shares
		.filter((share) => share.status !== "expired")
		.flatMap((share): AccessRow[] =>
			share.mode === "link"
				? [{ key: share.id, kind: "link", share }]
				: share.recipients.map((contact) => ({
						key: `${share.id}-${contact.id}`,
						kind: "contact",
						share,
						contact,
					})),
		);
	const editorRows = editors.map(
		(member): AccessRow => ({ key: member.id, kind: "editor", member }),
	);
	const rows = [...shareRows, ...editorRows].slice(0, SHOWN_ROWS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("files.access")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/shared" aria-label={t("shares.title")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{shareRows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("files.sharing.teamOnly")}
					</p>
				) : null}
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex items-center justify-between gap-3"
					>
						<div className="flex min-w-0 items-center gap-4">
							{row.kind === "link" ? (
								<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary [&_svg]:size-4">
									<GlobeSimpleIcon />
								</span>
							) : (
								<MemberAvatar
									name={
										row.kind === "contact" ? row.contact.name : row.member.name
									}
									size="md"
								/>
							)}
							<div className="grid min-w-0">
								<span className="truncate font-medium" dir="auto">
									{row.kind === "link"
										? t("shares.anyoneWithLink")
										: row.kind === "contact"
											? row.contact.name
											: row.member.name}
								</span>
								<span
									className="truncate text-muted-foreground text-xs"
									dir="auto"
								>
									{row.kind === "link"
										? t(`shares.access.${row.share.access}`)
										: row.kind === "contact"
											? row.contact.email
											: `${t("files.editor")} · ${row.member.email}`}
								</span>
							</div>
						</div>
						{row.kind === "link" ? (
							<Button size="sm" asChild>
								<Link to="/app/shared">{t("files.viewShare")}</Link>
							</Button>
						) : (
							<Button variant="outline" size="sm" asChild>
								<a
									href={`mailto:${row.kind === "contact" ? row.contact.email : row.member.email}`}
								>
									{t("files.email")}
								</a>
							</Button>
						)}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
