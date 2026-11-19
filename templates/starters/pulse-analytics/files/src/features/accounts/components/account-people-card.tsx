// The people card of the account page: the 5 most active users with their mail address and a copy button.
// AccountOverview renders it beside the events card. The arrow button opens the Users tab with every user.
import { copyToClipboard, initialsOf } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { AccountPerson } from "../api/accounts.queries";

// The kit card lists five people.
const SHOWN_PEOPLE = 5;

type AccountPeopleCardProps = {
	/** Every person of the account, the most events first. */
	people: AccountPerson[];
	/** Opens the Users tab of the page. */
	onViewAll: () => void;
};

/** Each row: initials, name, mail address, and "Copy email". */
export function AccountPeopleCard({
	people,
	onViewAll,
}: AccountPeopleCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.people.title")}</CardTitle>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={t("accounts.people.viewAll")}
								onClick={onViewAll}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("accounts.people.viewAll")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent>
				{/* grid-cols-1 is minmax(0, 1fr): a long mail address then wraps and does not widen the card. */}
				<ul className="grid grid-cols-1 gap-4">
					{people.slice(0, SHOWN_PEOPLE).map((person) => (
						<li
							key={person.id}
							className="flex items-center justify-between gap-4"
						>
							<div className="flex min-w-0 items-center gap-4">
								<Avatar className="size-10">
									<AvatarFallback>{initialsOf(person.name)}</AvatarFallback>
								</Avatar>
								<div className="min-w-0">
									<p className="truncate font-medium">{person.name}</p>
									{/* The address wraps and never clips. The line breaks after the "@".
									    wrap-anywhere breaks inside a part only when that part alone is too long. */}
									<p className="wrap-anywhere text-muted-foreground text-xs">
										{person.email.slice(0, person.email.indexOf("@") + 1)}
										<wbr />
										{person.email.slice(person.email.indexOf("@") + 1)}
									</p>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0"
								onClick={() =>
									copyToClipboard(person.email, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("accounts.people.copyEmail")}
							</Button>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
