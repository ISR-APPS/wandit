// The order screen: the table and the covers on top, the menu buttons, and the ticket in progress.
// The /app/order route renders it after its loader. The route also uses the skeleton and the error below.
// One cart per table lives in React state only. Preview shows the kitchen ticket; nothing reaches a server.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "~/features/app-shell";
import {
	type FloorTable,
	fillMessage,
	floorQueryOptions,
	formatCents,
	formatClock,
	menuQueryOptions,
	moneyFormat,
	TABLE_STATUS_DOT,
	ZONES,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	addToCart,
	type CartLine,
	changeQuantity,
	ticketTotals,
	toTicketLines,
} from "../lib/cart";
import { MenuPicker } from "./menu-picker";
import { TICKET_ANCHOR, TicketPanel } from "./ticket-panel";
import { TicketPreviewDialog } from "./ticket-preview-dialog";

// A new table with no booking and no guests starts at 2 covers: the most common party size.
const DEFAULT_COVERS = 2;

// The cart key before the server picks a table. A table id never takes this value.
const NO_TABLE = "";

type OrderEntryPageProps = {
	/** The `table` search param: the id of the chosen table, or undefined before a choice. */
	tableId: string | undefined;
};

/** The menu fills the main column. The ticket sits at the end, sticky; below 48rem a bar links to it. */
export function OrderEntryPage({ tableId }: OrderEntryPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const { data: menu } = useSuspenseQuery(menuQueryOptions());
	const { data: board } = useSuspenseQuery(floorQueryOptions());
	// The ticket in progress per table id, so a table change never moves lines to another table.
	const [cartByTable, setCartByTable] = useState<Record<string, CartLine[]>>(
		{},
	);
	// Covers that the server set by hand, per table id. A table with no entry uses its default.
	const [coversByTable, setCoversByTable] = useState<Record<string, number>>(
		{},
	);
	const [isPreviewOpen, setPreviewOpen] = useState(false);

	const money = moneyFormat(locale);
	const entry = board.find((candidate) => candidate.table.id === tableId);
	const cartKey = entry?.table.id ?? NO_TABLE;
	const cart = cartByTable[cartKey] ?? [];
	const updateCart = (change: (current: CartLine[]) => CartLine[]) =>
		setCartByTable((carts) => ({
			...carts,
			[cartKey]: change(carts[cartKey] ?? []),
		}));
	const covers = entry
		? (coversByTable[entry.table.id] ?? defaultCovers(entry))
		: DEFAULT_COVERS;
	const lines = toTicketLines(cart, menu);
	const totals = ticketTotals(lines);
	const coversText = fillMessage(t("orderEntry.coversCount"), {
		count: String(covers),
	});

	const setCovers = (delta: number) => {
		if (!entry) {
			return;
		}
		// Covers stay between 1 and the chairs of the table.
		const next = Math.min(entry.table.seats, Math.max(1, covers + delta));
		setCoversByTable((current) => ({ ...current, [entry.table.id]: next }));
	};
	const clearCart = () => {
		updateCart(() => []);
		setPreviewOpen(false);
		toast.success(t("orderEntry.cleared"));
	};

	const ticketDescription = entry?.openOrder
		? fillMessage(t("orderEntry.openCheckNote"), {
				number: String(entry.openOrder.number),
			})
		: entry
			? `${t(`zones.${entry.table.zone}`)} · ${coversText}`
			: t("orderEntry.chooseTable");
	const previewHeading = entry
		? [
				entry.table.name,
				t(`zones.${entry.table.zone}`),
				coversText,
				formatClock(new Date().toISOString(), locale),
			].join(" · ")
		: "";

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("orderEntry.title")}
				description={t("orderEntry.description")}
			/>
			<div className="grid @3xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start gap-6">
				<div className="grid min-w-0 gap-6">
					<Card className="gap-0 py-4">
						<CardContent className="flex flex-wrap items-end gap-x-6 gap-y-4 px-4">
							<div className="grid @xl/main:w-64 w-full gap-1.5 text-sm">
								<span className="text-muted-foreground">
									{t("orderEntry.table")}
								</span>
								<Select
									value={entry?.table.id ?? ""}
									onValueChange={(value) => {
										// Lines taken before any table choice go to the first table chosen, if its ticket is empty.
										if (
											cartKey === NO_TABLE &&
											cart.length > 0 &&
											(cartByTable[value] ?? []).length === 0
										) {
											setCartByTable((carts) => ({
												...carts,
												[NO_TABLE]: [],
												[value]: cart,
											}));
										}
										navigate({
											to: "/app/order",
											search: { table: value },
											replace: true,
										});
									}}
								>
									<SelectTrigger
										className="w-full"
										aria-label={t("orderEntry.table")}
									>
										<SelectValue placeholder={t("orderEntry.chooseTable")} />
									</SelectTrigger>
									<SelectContent>
										{ZONES.map((zone, zoneIndex) => (
											<SelectGroup key={zone}>
												{zoneIndex > 0 ? <SelectSeparator /> : null}
												<div className="px-2 py-1.5 text-muted-foreground text-xs">
													{t(`zones.${zone}`)}
												</div>
												{board
													.filter((option) => option.table.zone === zone)
													.map((option) => (
														<SelectItem
															key={option.table.id}
															value={option.table.id}
														>
															<span className="flex items-center gap-2">
																<span
																	aria-hidden="true"
																	className={cn(
																		"size-2 shrink-0 rounded-full",
																		TABLE_STATUS_DOT[option.status],
																	)}
																/>
																<span className="font-medium">
																	{option.table.name}
																</span>
																<span className="text-muted-foreground">
																	{t(`tableStatuses.${option.status}`)}
																</span>
															</span>
														</SelectItem>
													))}
											</SelectGroup>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-1.5 text-sm">
								<span className="text-muted-foreground">
									{t("orderEntry.covers")}
								</span>
								{/* Text signs, not icons: the filled icons of the theme draw a square with a cut-out sign. */}
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="icon"
										disabled={!entry || covers <= 1}
										aria-label={t("orderEntry.fewerCovers")}
										onClick={() => setCovers(-1)}
									>
										<span
											aria-hidden="true"
											className="font-semibold text-lg leading-none"
										>
											−
										</span>
									</Button>
									<span className="w-10 text-center font-numeric font-semibold text-lg tabular-nums">
										{entry ? covers : "-"}
									</span>
									<Button
										type="button"
										variant="outline"
										size="icon"
										disabled={!entry || covers >= entry.table.seats}
										aria-label={t("orderEntry.moreCovers")}
										onClick={() => setCovers(1)}
									>
										<span
											aria-hidden="true"
											className="font-semibold text-lg leading-none"
										>
											+
										</span>
									</Button>
								</div>
							</div>
							{entry ? (
								<p className="@xl/main:ms-auto @xl/main:self-center text-muted-foreground text-sm">
									{fillMessage(t("floor.seats"), {
										count: String(entry.table.seats),
									})}
									{entry.server ? ` · ${entry.server.name}` : null}
								</p>
							) : null}
						</CardContent>
					</Card>
					<MenuPicker
						items={menu}
						cart={cart}
						onAdd={(menuItemId) =>
							updateCart((current) => addToCart(current, menuItemId))
						}
					/>
				</div>
				<div className="@3xl/main:sticky @3xl/main:top-20">
					<TicketPanel
						title={
							entry
								? fillMessage(t("orderEntry.ticketFor"), {
										table: entry.table.name,
									})
								: t("orderEntry.ticket")
						}
						description={ticketDescription}
						lines={lines}
						onChangeQuantity={(menuItemId, delta) =>
							updateCart((current) =>
								changeQuantity(current, menuItemId, delta),
							)
						}
						onClear={clearCart}
						onPreview={() => setPreviewOpen(true)}
						canPreview={entry !== undefined && lines.length > 0}
						previewHint={t(
							entry ? "orderEntry.previewHintDish" : "orderEntry.previewHint",
						)}
					/>
				</div>
			</div>
			{/* Sticky, not fixed: the bar stays inside the main column, so it never runs under the sidebar rail. */}
			{lines.length > 0 ? (
				<div className="sticky bottom-3 z-10 @3xl/main:hidden rounded-surface border bg-card p-2 shadow-surface">
					<Button asChild className="h-12 w-full justify-between">
						<a href={`#${TICKET_ANCHOR}`}>
							<span>
								{t("orderEntry.viewTicket")}
								<span className="ms-2 tabular-nums opacity-80">
									{fillMessage(t("orderEntry.items"), {
										count: String(totals.itemCount),
									})}
								</span>
							</span>
							<span className="font-numeric font-semibold tabular-nums">
								{formatCents(money, totals.totalCents)}
							</span>
						</a>
					</Button>
				</div>
			) : null}
			<TicketPreviewDialog
				open={isPreviewOpen}
				onOpenChange={setPreviewOpen}
				heading={previewHeading}
				lines={lines}
				onStartNew={clearCart}
			/>
		</div>
	);
}

// The covers that a table starts with: its guests, its booking, or the default party size.
function defaultCovers(entry: FloorTable): number {
	return (
		entry.openOrder?.covers ??
		entry.seating?.covers ??
		entry.reservation?.covers ??
		Math.min(DEFAULT_COVERS, entry.table.seats)
	);
}

// Placeholder buttons of the skeleton. Fixed keys, because they never reorder.
const SKELETON_BUTTONS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the order loader runs: the header, the table bar, the menu grid, and the ticket. */
export function OrderEntryPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<div className="grid @3xl/main:grid-cols-[minmax(0,1fr)_20rem] grid-cols-1 items-start gap-6">
				<div className="grid gap-6">
					<Skeleton className="h-24 w-full rounded-surface" />
					<Skeleton className="h-9 w-full max-w-md" />
					<div className="grid @3xl/main:grid-cols-2 @5xl/main:grid-cols-3 @xl/main:grid-cols-3 grid-cols-2 gap-3">
						{SKELETON_BUTTONS.map((key) => (
							<Skeleton key={key} className="h-28 rounded-surface" />
						))}
					</div>
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent className="grid gap-3">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the order screen when its loader fails. Try again runs the loader again. */
export function OrderEntryPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("orderEntry.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
