// The dossier tab: the only shaped form of the page. The header, the section heads, the hero rail, and the folders use it.
// It renders a link when it has an href, else a plain label. landing.css draws the trapezoid and its 1px brass edge.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

/** The height role of a tab: 34px in the header, 38px on a section head, 46px on the hero rail. */
type TabSize = "nav" | "section" | "rail";

type DossierTabProps = {
	/** The text of the tab, in brass small caps. */
	children: ReactNode;
	/** A same-page anchor such as "#fees". Without it the tab is a label, not a link. */
	href?: string;
	/** True for the filled brass tab: the call to action or the current item. */
	isOn?: boolean;
	size?: TabSize;
	className?: string;
};

const SIZE_CLASS: Record<TabSize, string> = {
	nav: "",
	section: "vt-tab-section",
	rail: "vt-tab-rail",
};

/** A trapezoid tab that sinks 1px into the rule under it. A link tab rises 3px on hover and focus. */
export function DossierTab({
	children,
	href,
	isOn = false,
	size = "nav",
	className,
}: DossierTabProps) {
	const classes = cn(
		"vt-tab vt-on-rule",
		SIZE_CLASS[size],
		isOn && "vt-tab-on",
		className,
	);
	const label = <span className={LABEL}>{children}</span>;
	if (href === undefined) {
		return <span className={classes}>{label}</span>;
	}
	return (
		<a href={href} className={classes}>
			{label}
		</a>
	);
}
