// One figure card of the fleet page: a label with a small badge at the end, and a large value under it.
// FleetPage renders four of them in a row above the vehicle table. The badge gives the scope of the value.
import type { VariantProps } from "class-variance-authority";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";

type FleetStatCardProps = {
	label: string;
	/** The formatted value, for example "9" or "18,400 kg". */
	value: string;
	/** A short translated scope of the value, for example "64% of fleet". */
	badge: string;
	/** The badge look: "warning" when the figure needs the desk, else "outline". */
	badgeVariant: NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
};

/** The card holds only a CardHeader, as the kit product figures do. */
export function FleetStatCard({
	label,
	value,
	badge,
	badgeVariant,
}: FleetStatCardProps) {
	return (
		<Card>
			<CardHeader className="gap-2">
				<CardDescription>{label}</CardDescription>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
				<CardAction>
					<Badge variant={badgeVariant} className="tabular-nums">
						{badge}
					</Badge>
				</CardAction>
			</CardHeader>
		</Card>
	);
}
