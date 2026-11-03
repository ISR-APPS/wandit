/**
 * The kit icons. The kit, the app shell, and the pages import these icons from "~/shared/ui/icons".
 * Each one is the Phosphor icon of the same name. Pages import other icons from "@phosphor-icons/react".
 * The IconContext of __root.tsx gives every icon the weight of the icons axis of theme.json.
 * The kit controls (carets, check, close, search, sort, sidebar toggle, sign-out, spinner) keep a line weight.
 */
import {
	ArrowsDownUpIcon as ArrowsDownUp,
	CaretDownIcon as CaretDown,
	CaretLeftIcon as CaretLeft,
	CaretRightIcon as CaretRight,
	CaretUpIcon as CaretUp,
	CaretUpDownIcon as CaretUpDown,
	CheckIcon as Check,
	CircleNotchIcon as CircleNotch,
	type Icon,
	IconContext,
	type IconProps,
	type IconWeight,
	MagnifyingGlassIcon as MagnifyingGlass,
	SidebarSimpleIcon as SidebarSimple,
	SignOutIcon as SignOut,
	XIcon as X,
} from "@phosphor-icons/react";
import {
	type ComponentType,
	createElement,
	forwardRef,
	useContext,
} from "react";

// Status and nav icons take the theme weight as it is.
export {
	ArrowRightIcon,
	CheckCircleIcon,
	InfoIcon,
	UserIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";

// Phosphor draws the fill and duotone of an open glyph (X, Check, the sidebar) as a box around it.
// A boxed close button or select check looks like a checkbox, so a control takes the nearest line weight.
const LINE_WEIGHT_OF: Record<IconWeight, IconWeight> = {
	thin: "thin",
	light: "light",
	regular: "regular",
	bold: "bold",
	fill: "bold",
	duotone: "regular",
};

/**
 * The control form of a Phosphor icon: the line weight nearest to the theme weight of the IconContext.
 * It replaces a weight prop of the caller.
 */
function controlIcon(icon: Icon): Icon {
	return forwardRef<SVGSVGElement, IconProps>(function ControlIcon(props, ref) {
		const { weight = "regular" } = useContext(IconContext);
		return createElement(icon, {
			...props,
			ref,
			weight: LINE_WEIGHT_OF[weight],
		});
	});
}

export const ArrowsDownUpIcon = controlIcon(ArrowsDownUp);
export const CaretDownIcon = controlIcon(CaretDown);
export const CaretLeftIcon = controlIcon(CaretLeft);
export const CaretRightIcon = controlIcon(CaretRight);
export const CaretUpDownIcon = controlIcon(CaretUpDown);
export const CaretUpIcon = controlIcon(CaretUp);
export const CheckIcon = controlIcon(Check);
export const CircleNotchIcon = controlIcon(CircleNotch);
export const MagnifyingGlassIcon = controlIcon(MagnifyingGlass);
export const SidebarSimpleIcon = controlIcon(SidebarSimple);
export const SignOutIcon = controlIcon(SignOut);
export const XIcon = controlIcon(X);

/** The icon type of NAV_ITEMS and of icon maps such as KPI_ICONS: any Phosphor icon, or another component that takes className. */
export type KitIcon = ComponentType<{ className?: string }>;
