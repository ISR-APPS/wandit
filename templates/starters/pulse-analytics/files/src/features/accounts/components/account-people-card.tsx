// The people card of the account page: the most active people of the last 30 days.
// AccountDetailPage renders it with the people that the account query returns.
// Under 1024 px the table has two columns: the role goes under the name.
import {
	fillMessage,
	formatRelativeTime,
	NameMark,
	useIsWideScreen,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { AccountPerson } from "../api/accounts.queries";

type AccountPeopleCardProps = {
	/** The most active people, the most events first, then the last seen first. */
	people: AccountPerson[];
	/** How many people the account has in total. */
	members: number;
};

/**
 * One row per person: the name and the mail address, the role, the events, and the last event time.
 * When nobody has an event in 30 days, the card lists the people seen last instead.
 */
export function AccountPeopleCard({ people, members }: AccountPeopleCardProps) {
	const { t, locale } = useT();
	const isWide = useIsWideScreen();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	// A dormant account: ten rows of 0 events say nothing, so the card ranks by the last event.
	const isQuiet = people.every((person) => person.events === 0);
	const lastSeenOf = (person: AccountPerson) =>
		person.lastSeenAt
			? formatRelativeTime(person.lastSeenAt, now, locale)
			: t("accounts.neverSeen");
	const roleBadge = (person: AccountPerson) => (
		<Badge variant={person.role === "admin" ? "info" : "outline"}>
			{t(`roles.${person.role}`)}
		</Badge>
	);
	// A dormant account has 0 events for each person, so the column hides at every width.
	const showsEvents = !isQuiet;
	const showsLastSeen = isWide || isQuiet;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{t(isQuiet ? "accounts.people.quietTitle" : "accounts.people.title")}
				</CardTitle>
				<CardDescription>
					{fillMessage(
						t(
							isQuiet
								? "accounts.people.quietDescription"
								: "accounts.people.description",
						),
						{
							shown: number.format(people.length),
							total: number.format(members),
						},
					)}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("accounts.people.person")}</TableHead>
							{isWide ? (
								<TableHead>{t("accounts.people.role")}</TableHead>
							) : null}
							{showsEvents ? (
								<TableHead className="text-end">
									{t("accounts.people.events")}
								</TableHead>
							) : null}
							{showsLastSeen ? (
								<TableHead className="text-end">
									{t("accounts.people.lastSeen")}
								</TableHead>
							) : null}
						</TableRow>
					</TableHeader>
					<TableBody>
						{people.map((person) => (
							<TableRow key={person.id}>
								<TableCell>
									<div className="flex items-center gap-3">
										<NameMark name={person.name} />
										<div className="grid justify-items-start gap-0.5">
											<span className="font-medium">{person.name}</span>
											{isWide ? (
												<span className="text-muted-foreground text-xs">
													{person.email}
												</span>
											) : (
												roleBadge(person)
											)}
										</div>
									</div>
								</TableCell>
								{isWide ? <TableCell>{roleBadge(person)}</TableCell> : null}
								{showsEvents ? (
									<TableCell className="text-end tabular-nums">
										{number.format(person.events)}
									</TableCell>
								) : null}
								{showsLastSeen ? (
									<TableCell className="whitespace-nowrap text-end text-muted-foreground">
										{lastSeenOf(person)}
									</TableCell>
								) : null}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
