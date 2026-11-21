// The trade card of the home: Buy and Sell tabs, an asset select, the units and the money amount, and a submit button.
// PortfolioPage renders it third in band 1. A submit records a pending transaction with useRecordTradeMutation.
// The two amount fields are linked: the user types in one, and the card computes the other from the current price.
import { useId, useState } from "react";
import { toast } from "sonner";
import { type Transaction, useRecordTradeMutation } from "~/features/activity";
import type { Position } from "~/features/holdings";
import {
	AssetGlyph,
	CURRENCY,
	fillMessage,
	formatPrice,
	formatQuantity,
} from "~/features/ledger";
import type { Asset } from "~/features/markets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { parseTradeQuantity, type TradeError } from "../lib/trade-form";

type TradeCardProps = {
	/** Every asset of the market list, the largest market cap first. A buy can pick any of them. */
	assets: Asset[];
	/** Every held asset. A sell can pick only these, up to the units held minus the pending sells. */
	positions: Position[];
	/** Every transaction, as transactionsQueryOptions returns them. The card reads the pending sells. */
	transactions: Transaction[];
};

/** The field that the user typed in last, with its raw text. The other field is derived from it. */
type AmountEntry = { field: "units" | "usd"; text: string };

// The derived field shows a plain number that the input can take back: no group separator, no currency sign.
function plainNumber(value: number, decimals: number): string {
	return Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : "";
}

/** The card keeps the side, the asset, and the amount in state. The amounts reset after a recorded trade. */
export function TradeCard({ assets, positions, transactions }: TradeCardProps) {
	const { t, locale } = useT();
	const formId = useId();
	const [side, setSide] = useState<"buy" | "sell">("buy");
	const [chosenId, setChosenId] = useState(assets[0]?.id ?? "");
	const [entry, setEntry] = useState<AmountEntry>({ field: "units", text: "" });
	const [error, setError] = useState<TradeError | null>(null);
	const recordTrade = useRecordTradeMutation();

	const heldById = new Map(
		positions.map((position) => [position.id, position]),
	);
	const choices =
		side === "buy" ? assets : assets.filter((asset) => heldById.has(asset.id));
	// A sell offers only held assets: a chosen asset that the user does not hold falls back to the first held one.
	const asset = choices.find((row) => row.id === chosenId) ?? choices[0];
	const held = asset ? heldById.get(asset.id) : undefined;
	// A pending sell does not change the position yet, so two pending sells could sell more than the units held.
	const pendingSold = transactions
		.filter(
			(row) =>
				row.assetId === asset?.id &&
				row.type === "sell" &&
				row.status === "pending",
		)
		.reduce((sum, row) => sum + row.quantity, 0);
	// Rounded to 8 decimals, the smallest unit of the ledger, so a float rest never blocks a full sell.
	const sellable = Math.max(
		0,
		Math.round(((held?.quantity ?? 0) - pendingSold) * 1e8) / 1e8,
	);
	const sellableLine = asset
		? `${formatQuantity(sellable, locale)} ${asset.symbol}`
		: "";
	const typed = Number(entry.text.trim());
	const hasNumber = entry.text.trim() !== "" && Number.isFinite(typed);
	const unitsText =
		entry.field === "units"
			? entry.text
			: hasNumber && asset
				? plainNumber(typed / asset.price, 8)
				: "";
	const usdText =
		entry.field === "usd"
			? entry.text
			: hasNumber && asset
				? plainNumber(typed * asset.price, 2)
				: "";

	function submit() {
		if (!asset) {
			return;
		}
		const result = parseTradeQuantity({
			text: entry.text,
			field: entry.field,
			unitPrice: asset.price,
			sellableQuantity: side === "sell" ? sellable : null,
		});
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setError(null);
		const line = `${formatQuantity(result.quantity, locale)} ${asset.symbol}`;
		recordTrade.mutate(
			{
				assetId: asset.id,
				type: side,
				quantity: result.quantity,
				unitPrice: asset.price,
				// A new asset goes to the trading account. A held asset stays in its account.
				account: held?.account ?? "trading",
			},
			{
				onSuccess: () => {
					setEntry({ field: entry.field, text: "" });
					toast.success(
						fillMessage(t(`portfolio.tradeDone.${side}`), { line }),
					);
				},
				onError: (cause) => {
					console.error("record trade failed", cause);
					toast.error(t("portfolio.tradeFailed"));
				},
			},
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>
					{asset
						? fillMessage(t("portfolio.tradePrice"), { name: asset.name })
						: t("portfolio.tradeTitle")}
				</CardDescription>
				<CardTitle className="font-numeric text-3xl tabular-nums">
					{asset ? formatPrice(asset.price, locale) : "—"}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<Tabs
					value={side}
					onValueChange={(value) => {
						setSide(value === "sell" ? "sell" : "buy");
						setError(null);
					}}
				>
					<TabsList
						className="mb-4 w-full"
						aria-label={t("portfolio.tradeTitle")}
					>
						<TabsTrigger value="buy" className="w-full">
							{t("ledger.types.buy")}
						</TabsTrigger>
						<TabsTrigger value="sell" className="w-full">
							{t("ledger.types.sell")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				{asset ? (
					<form
						className="grid gap-6"
						onSubmit={(event) => {
							event.preventDefault();
							submit();
						}}
					>
						<div className="grid gap-2">
							<Label htmlFor={`${formId}-asset`}>
								{t("portfolio.tradeAsset")}
							</Label>
							<Select value={asset.id} onValueChange={setChosenId}>
								<SelectTrigger id={`${formId}-asset`} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="max-h-72">
									{choices.map((choice) => (
										<SelectItem key={choice.id} value={choice.id}>
											{/* One row, so the trigger shows the glyph beside the name. */}
											<span className="flex items-center gap-2">
												<AssetGlyph
													symbol={choice.symbol}
													category={choice.category}
													size="sm"
												/>
												{`${choice.name} / ${choice.symbol}`}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid @xl/main:grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor={`${formId}-units`}>
									{fillMessage(t("portfolio.tradeAmountIn"), {
										unit: asset.symbol,
									})}
								</Label>
								<Input
									id={`${formId}-units`}
									inputMode="decimal"
									autoComplete="off"
									placeholder="0"
									value={unitsText}
									aria-invalid={error !== null}
									aria-describedby={`${formId}-note`}
									onChange={(event) =>
										setEntry({ field: "units", text: event.target.value })
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor={`${formId}-usd`}>
									{fillMessage(t("portfolio.tradeAmountIn"), {
										unit: CURRENCY,
									})}
								</Label>
								<Input
									id={`${formId}-usd`}
									inputMode="decimal"
									autoComplete="off"
									placeholder="0.00"
									value={usdText}
									aria-invalid={error !== null}
									aria-describedby={`${formId}-note`}
									onChange={(event) =>
										setEntry({ field: "usd", text: event.target.value })
									}
								/>
							</div>
							<p
								id={`${formId}-note`}
								aria-live="polite"
								className={
									error
										? "@xl/main:col-span-2 text-destructive text-sm"
										: "@xl/main:col-span-2 text-muted-foreground text-sm"
								}
							>
								{error === "aboveHeld"
									? fillMessage(t("portfolio.tradeAboveHeld"), {
											line: sellableLine,
										})
									: error === "invalidAmount"
										? t("portfolio.tradeInvalid")
										: side === "sell"
											? fillMessage(t("portfolio.tradeHeld"), {
													line: sellableLine,
												})
											: t("portfolio.tradeNote")}
							</p>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={recordTrade.isPending}
						>
							{t(`portfolio.tradeSubmit.${side}`)}
						</Button>
					</form>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("portfolio.tradeNothingToSell")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
