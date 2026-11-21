// The owner's list of the other accounts, in a dialog: approve, refuse, or remove an account.
// NavUser of the app shell opens it from the user menu, for the owner only.
// It reads accessRequestsQueryOptions() and writes with useDecideAccessMutation(). RLS refuses every other account.
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type AccessDecision,
	useDecideAccessMutation,
} from "../api/access.mutations";
import {
	type AppAccess,
	accessRequestsQueryOptions,
} from "../api/access.queries";

type AccessRequestsDialogProps = {
	/** True while the dialog shows. NavUser holds this state. */
	open: boolean;
	/** Radix calls it with false when the owner closes the dialog. */
	onOpenChange: (open: boolean) => void;
	/** Radix calls it after the close, before its own focus handler. NavUser moves the focus to the menu button. */
	onCloseAutoFocus: (event: Event) => void;
};

/** The badge of each status: a word plus a color. */
const STATUS_BADGES = {
	pending: { variant: "warning", labelKey: "appAccess.statusPending" },
	approved: { variant: "success", labelKey: "appAccess.statusApproved" },
	refused: { variant: "secondary", labelKey: "appAccess.statusRefused" },
} as const satisfies Record<
	AppAccess["status"],
	{ variant: "warning" | "success" | "secondary"; labelKey: TranslationKey }
>;

/** The dialog of the access requests. Render it only for the owner: another account gets only its own row. */
export function AccessRequestsDialog({
	open,
	onOpenChange,
	onCloseAutoFocus,
}: AccessRequestsDialogProps) {
	const { t, locale } = useT();
	const requests = useQuery(accessRequestsQueryOptions());
	const decide = useDecideAccessMutation();
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	// The owner row never changes, so the list leaves it out. The accounts that wait come first.
	// The sort is stable, so each group keeps the order of the query: newest first.
	const accounts = (requests.data ?? [])
		.filter((account) => account.role !== "owner")
		.sort(
			(first, second) =>
				Number(second.status === "pending") -
				Number(first.status === "pending"),
		);

	function onDecide(decision: AccessDecision) {
		decide.mutate(decision, {
			onError: () => toast.error(t("appAccess.decideError")),
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* The kit panel is as wide as a phone screen. The margin keeps its edges visible at 375 px. */}
			<DialogContent
				className="max-w-[calc(100%-2rem)] sm:max-w-lg"
				onCloseAutoFocus={onCloseAutoFocus}
			>
				<DialogHeader>
					<DialogTitle>{t("appAccess.requests")}</DialogTitle>
					<DialogDescription>{t("appAccess.requestsHint")}</DialogDescription>
				</DialogHeader>
				{requests.isPending ? (
					<div className="grid gap-4">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				) : requests.isError ? (
					<div className="grid gap-4">
						<p role="alert" className="text-sm">
							{t("appAccess.requestsError")}
						</p>
						<Button
							type="button"
							variant="outline"
							className="justify-self-start"
							onClick={() => requests.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : accounts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("appAccess.requestsEmpty")}
					</p>
				) : (
					<ul className="grid max-h-96 gap-4 overflow-y-auto">
						{accounts.map((account) => {
							const badge = STATUS_BADGES[account.status];
							return (
								<li
									key={account.userId}
									className="grid gap-2 sm:flex sm:items-center sm:justify-between sm:gap-4"
								>
									<div className="grid min-w-0 gap-1">
										<span dir="auto" className="truncate font-medium text-sm">
											{account.email}
										</span>
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<Badge variant={badge.variant}>{t(badge.labelKey)}</Badge>
											<time dateTime={account.requestedAt.toISOString()}>
												{dateFormat.format(account.requestedAt)}
											</time>
										</div>
									</div>
									<div className="flex shrink-0 gap-2">
										{/* Product rule: the owner removes an approved account, and approves each other account.
										    Refuse and Remove both set "refused": the update policy accepts no other value to stop an account. */}
										{account.status === "approved" ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={decide.isPending}
												onClick={() =>
													onDecide({
														userId: account.userId,
														status: "refused",
													})
												}
											>
												{t("appAccess.remove")}
											</Button>
										) : (
											<Button
												type="button"
												size="sm"
												disabled={decide.isPending}
												onClick={() =>
													onDecide({
														userId: account.userId,
														status: "approved",
													})
												}
											>
												{t("appAccess.approve")}
											</Button>
										)}
										{account.status === "pending" ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={decide.isPending}
												onClick={() =>
													onDecide({
														userId: account.userId,
														status: "refused",
													})
												}
											>
												{t("appAccess.refuse")}
											</Button>
										) : null}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}
