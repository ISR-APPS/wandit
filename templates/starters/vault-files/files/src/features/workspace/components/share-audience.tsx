// Who receives a share: "Anyone with the link" with a globe, or the invited contacts with their company.
// The Shared page table and the sharing card of the file page render it.
import { GlobeSimpleIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import type { ShareItem } from "../lib/workspace";
import { MemberAvatar } from "./member-avatar";

type ShareAudienceProps = {
	share: Pick<ShareItem, "mode" | "recipients">;
};

/** Two lines: the audience, then the company of the contacts or "Public link". min-w-40 keeps them readable on a phone. */
export function ShareAudience({ share }: ShareAudienceProps) {
	const { t } = useT();
	if (share.mode === "link") {
		return (
			<div className="flex min-w-40 items-center gap-2.5">
				<span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground [&_svg]:size-3.5">
					<GlobeSimpleIcon />
				</span>
				<div className="grid min-w-0">
					<span className="truncate">{t("shares.anyoneWithLink")}</span>
					<span className="truncate text-muted-foreground text-xs">
						{t("shares.publicLink")}
					</span>
				</div>
			</div>
		);
	}
	const organizations = [
		...new Set(share.recipients.map((contact) => contact.organization)),
	];
	return (
		<div className="flex min-w-40 items-center gap-2.5">
			<span className="flex shrink-0 -space-x-2">
				{share.recipients.slice(0, 2).map((contact) => (
					<MemberAvatar
						key={contact.id}
						name={contact.name}
						className="ring-2 ring-card"
					/>
				))}
			</span>
			<div className="grid min-w-0 justify-items-start">
				<span className="max-w-full truncate" dir="auto">
					{share.recipients.map((contact) => contact.name).join(", ")}
				</span>
				<span
					className="max-w-full truncate text-muted-foreground text-xs"
					dir="auto"
				>
					{organizations.join(", ")}
				</span>
			</div>
		</div>
	);
}
