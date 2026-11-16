// The square tile that stands for a home in a list: the icon of its type on a tint.
// The listing tables, the listing detail header, and the agenda render it. The sample homes have no photo.
import {
	BuildingApartmentIcon,
	BuildingIcon,
	BuildingsIcon,
	HouseLineIcon,
	WarehouseIcon,
} from "@phosphor-icons/react";
import { cn } from "~/shared/lib/utils";
import type { KitIcon } from "~/shared/ui/icons";
import type { PropertyType } from "../lib/sample-listings";

const TYPE_ICONS = {
	apartment: BuildingApartmentIcon,
	house: HouseLineIcon,
	townhouse: BuildingsIcon,
	loft: WarehouseIcon,
	studio: BuildingIcon,
} satisfies Record<PropertyType, KitIcon>;

/** A home with its own front door has the warm tint. A unit in a building has the cool tint. */
const TYPE_TINTS = {
	apartment: "bg-secondary text-secondary-foreground",
	house: "bg-accent text-accent-foreground",
	townhouse: "bg-accent text-accent-foreground",
	loft: "bg-secondary text-secondary-foreground",
	studio: "bg-secondary text-secondary-foreground",
} satisfies Record<PropertyType, string>;

type PropertyTileProps = {
	/** The kind of home. It picks the icon and the tint. */
	type: PropertyType;
	/** Size classes, for example "size-12". The default size is 2.5rem. */
	className?: string;
};

/** Decorative: the text beside it names the home, so screen readers skip the tile. */
export function PropertyTile({ type, className }: PropertyTileProps) {
	const TypeIcon = TYPE_ICONS[type];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-md",
				TYPE_TINTS[type],
				className,
			)}
		>
			<TypeIcon className="size-1/2" />
		</span>
	);
}
