// The till screen, in the anatomy of the kit POS page: a header row with the table, the covers, and the menu search,
// then the category tiles and the dish grid (3/4), and the ticket column at the end side (1/4).
// The /app/order route renders it after its loader. The route also uses the skeleton and the error below.
// One cart per table lives in React state only. Preview shows the kitchen ticket; nothing reaches a server.
import { ChairIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "~/features/app-shell";
import {
	countLabel,
	type FloorTable,
	fillMessage,
	floorQueryOptions,
	formatCents,
	formatClock,
	type MenuCategory,
	menuQueryOptions,
	moneyFormat,
	TABLE_STATUS_DOT,
	ZONES,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
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
import { CategoryTiles } from "./category-tiles";
import { DishCard } from "./dish-card";
import { TICKET_ANCHOR, TicketCard } from "./ticket-card";
import { TicketPreviewDialog } from "./ticket-preview-dialog";

// A new table with no booking and no guests starts at 2 covers: the most common party size.
const DEFAULT_COVERS = 2;

// The cart key before the server picks a table. A table id never takes this value.
const NO_TABLE = "";

type OrderEntryPageProps = {
	/** The `table` search param: the id of the chosen table, or undefined before a choice. */
	tableId: string | undefined;
};

/** The ticket column is sticky and as high as the screen from the @4xl/main width. Below it, a bar links to it. */
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
	const [category, setCategory] = useState<MenuCategory | "all">("all");
	const [query, setQuery] = useState("");
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
	const coversText = countLabel(
		covers,
		t("counts.covers.one"),
		t("counts.covers.other"),
		locale,
	);
	// A search looks in the whole menu, as in the kit: the category tiles apply only to an empty search.
	const needle = query.trim().toLocaleLowerCase(locale);
	const shownItems = needle
		? menu.filter((item) =>
				item.name.toLocaleLowerCase(locale).includes(needle),
			)
		: category === "all"
			? menu
			: menu.filter((item) => item.category === category);

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
		<div className="grid @4xl/main:grid-cols-4 gap-4">
			<div className="@4xl/main:col-span-3 flex min-w-0 flex-col gap-4">
				<PageHeader
					title={t("orderEntry.title")}
					actions={
						<>
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
									className="w-auto min-w-36 gap-2"
									aria-label={t("orderEntry.table")}
								>
									<ChairIcon className="size-4 text-muted-foreground" />
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
							{/* Text signs, not icons: the filled icons of the theme draw a square with a cut-out sign. */}
							<fieldset
								aria-label={t("orderEntry.covers")}
								className="inline-flex h-9 items-center overflow-hidden rounded-md border bg-card"
							>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									disabled={!entry || covers <= 1}
									aria-label={t("orderEntry.fewerCovers")}
									onClick={() => setCovers(-1)}
								>
									<span aria-hidden="true">−</span>
								</Button>
								<span className="min-w-20 text-center text-sm tabular-nums">
									{coversText}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									disabled={!entry || covers >= entry.table.seats}
									aria-label={t("orderEntry.moreCovers")}
									onClick={() => setCovers(1)}
								>
									<span aria-hidden="true">+</span>
								</Button>
							</fieldset>
							<div className="relative w-full sm:w-56">
								<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
								<Input
									type="search"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={t("orderEntry.search")}
									aria-label={t("orderEntry.search")}
									className="ps-8"
								/>
							</div>
						</>
					}
				/>
				<CategoryTiles
					value={category}
					onValueChange={(value) => {
						setCategory(value);
						setQuery("");
					}}
				/>
				{shownItems.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("orderEntry.noResults")}
					</p>
				) : (
					<div className="grid @3xl/main:grid-cols-4 @5xl/main:grid-cols-5 @xl/main:grid-cols-3 grid-cols-2 gap-4">
						{shownItems.map((item) => (
							<DishCard
								key={item.id}
								item={item}
								quantityInCart={
									cart.find((line) => line.menuItemId === item.id)?.quantity ??
									0
								}
								onAdd={() =>
									updateCart((current) => addToCart(current, item.id))
								}
							/>
						))}
					</div>
				)}
			</div>
			<div className="@4xl/main:sticky @4xl/main:top-20 @4xl/main:h-[calc(100svh-7rem)]">
				<TicketCard
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
						updateCart((current) => changeQuantity(current, menuItemId, delta))
					}
					onRemove={(menuItemId) =>
						updateCart((current) =>
							current.filter((line) => line.menuItemId !== menuItemId),
						)
					}
					onClear={clearCart}
					onPreview={() => setPreviewOpen(true)}
					hasTable={entry !== undefined}
				/>
			</div>
			{/* Sticky, not fixed: the bar stays inside the main column, so it never runs under the sidebar rail. */}
			{lines.length > 0 ? (
				<div className="sticky bottom-3 z-10 @4xl/main:hidden rounded-surface border bg-card p-2 shadow-surface">
					<Button asChild className="h-12 w-full justify-between">
						<a href={`#${TICKET_ANCHOR}`}>
							<span>
								{t("orderEntry.viewTicket")}
								<span className="ms-2 tabular-nums opacity-80">
									{countLabel(
										totals.itemCount,
										t("counts.items.one"),
										t("counts.items.other"),
										locale,
									)}
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

// Placeholder tiles of the skeleton. Fixed keys, because they never reorder.
const SKELETON_TILES = ["1", "2", "3", "4", "5", "6"];
const SKELETON_DISHES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the till loader runs: the header, the category row, the dish grid, and the ticket. */
export function OrderEntryPageSkeleton() {
	return (
		<div className="grid @4xl/main:grid-cols-4 gap-4">
			<div className="@4xl/main:col-span-3 flex flex-col gap-4">
				<Skeleton className="h-9 w-full max-w-lg" />
				<div className="flex gap-4 overflow-hidden">
					{SKELETON_TILES.map((key) => (
						<Skeleton
							key={key}
							className="@4xl/main:h-32 h-24 @4xl/main:w-auto w-24 @4xl/main:flex-1 shrink-0 rounded-md"
						/>
					))}
				</div>
				<div className="grid @3xl/main:grid-cols-4 @5xl/main:grid-cols-5 @xl/main:grid-cols-3 grid-cols-2 gap-4">
					{SKELETON_DISHES.map((key) => (
						<Skeleton key={key} className="h-52 rounded-md" />
					))}
				</div>
			</div>
			<Skeleton className="h-96 rounded-surface" />
		</div>
	);
}

/** Error state of the till screen when its loader fails. Try again runs the loader again. */
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
