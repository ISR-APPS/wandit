// The front of a payment card, drawn in the sidebar colors of the theme, in two sizes.
// The card tiles of the cards page show the small face. The card detail page shows the large face.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type CardFaceProps = {
	/** The last 4 digits of the card number. */
	numberEnding: string;
	/** The name on the card. Only the large face shows it. */
	holderName: string;
	/** The expiry as "MM/YY". Only the large face shows it. */
	expiry: string;
	/** True for a virtual card: the large face shows "Virtual" in place of "Debit", and it has no chip. */
	isVirtual: boolean;
	/** True draws the face faded, for a frozen or cancelled card. */
	isInactive: boolean;
	size: "small" | "large";
};

/** The face has the ratio of a real card (85.6 x 54 mm). It hides from screen readers: the page text says the same. */
export function CardFace({
	numberEnding,
	holderName,
	expiry,
	isVirtual,
	isInactive,
	size,
}: CardFaceProps) {
	const { t } = useT();
	const isLarge = size === "large";
	return (
		<div
			aria-hidden="true"
			className={cn(
				"relative flex aspect-[1.586] shrink-0 flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground",
				isLarge ? "w-full max-w-80 rounded-xl p-5" : "w-20 rounded-md p-2",
				isInactive && "opacity-55",
			)}
		>
			{/* Two rings of the sidebar border color give the face a quiet guilloche mark. */}
			<span className="pointer-events-none absolute -end-1/4 -top-1/2 aspect-square w-3/4 rounded-full border border-sidebar-foreground/15" />
			<span className="pointer-events-none absolute -end-1/3 -top-1/3 aspect-square w-3/4 rounded-full border border-sidebar-foreground/10" />
			<div className="flex items-start justify-between">
				<span
					className={cn(
						"font-display font-semibold",
						isLarge ? "text-lg" : "text-[0.5rem] leading-none",
					)}
				>
					{t("common.appName")}
				</span>
				{isLarge ? (
					<span className="text-sidebar-foreground/70 text-xs">
						{isVirtual ? t("cards.kinds.virtual") : t("cards.debit")}
					</span>
				) : null}
			</div>
			{isLarge && !isVirtual ? (
				<span className="h-7 w-10 rounded-sm border border-sidebar-foreground/30 bg-sidebar-foreground/15" />
			) : null}
			<div className="flex items-end justify-between gap-2">
				<div className="grid gap-1">
					{isLarge ? (
						<span className="font-medium text-sm">{holderName}</span>
					) : null}
					<span
						className={cn(
							"font-numeric tabular-nums",
							isLarge ? "text-base" : "text-[0.625rem] leading-none",
						)}
					>
						{`•••• ${numberEnding}`}
					</span>
				</div>
				{isLarge ? (
					<span className="font-numeric text-sidebar-foreground/70 text-xs tabular-nums">
						{expiry}
					</span>
				) : null}
			</div>
		</div>
	);
}
