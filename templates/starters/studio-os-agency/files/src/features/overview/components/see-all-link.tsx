// The "See all" link at the end of a panel header. It opens the full list page of the panel.
// The three entity tables of the overview render it in their CardAction.
import { Link, type LinkProps } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { CaretRightIcon } from "~/shared/ui/icons";

type SeeAllLinkProps = {
	/** The list page. The route type checks it. */
	to: LinkProps["to"];
};

/** A 44 px touch area with a caret that turns in Arabic. */
export function SeeAllLink({ to }: SeeAllLinkProps) {
	const { t } = useT();
	// The negative top margin centers the text on the one-line title, and the touch area stays 44 px.
	return (
		<Link
			to={to}
			className="-me-2 -mt-3.5 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-medium text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:-mt-2 md:min-h-8"
		>
			{t("overview.seeAll")}
			<CaretRightIcon className="size-4 rtl:rotate-180" />
		</Link>
	);
}
