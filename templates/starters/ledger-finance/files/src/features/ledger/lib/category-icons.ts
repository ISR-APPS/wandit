// The icon of each category. The payee avatar of the tables and the detail pages reads it.
// Each icon names the object of the category, so a row reads at a glance without its label.
import {
	AppWindowIcon,
	ArrowsLeftRightIcon,
	BriefcaseIcon,
	CalendarCheckIcon,
	ChalkboardTeacherIcon,
	CoinsIcon,
	DesktopIcon,
	HouseIcon,
	MegaphoneIcon,
	PaperclipIcon,
	ReceiptIcon,
	ShieldCheckIcon,
	SuitcaseRollingIcon,
	UserGearIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import type { KitIcon } from "~/shared/ui/icons";
import type { CategoryId } from "./categories";

/** One icon per category. */
export const CATEGORY_ICONS = {
	client_projects: BriefcaseIcon,
	retainers: CalendarCheckIcon,
	workshops: ChalkboardTeacherIcon,
	other_income: CoinsIcon,
	payroll: UsersThreeIcon,
	rent: HouseIcon,
	contractors: UserGearIcon,
	software: AppWindowIcon,
	marketing: MegaphoneIcon,
	travel: SuitcaseRollingIcon,
	supplies: PaperclipIcon,
	equipment: DesktopIcon,
	insurance: ShieldCheckIcon,
	taxes: ReceiptIcon,
	transfer: ArrowsLeftRightIcon,
} satisfies Record<CategoryId, KitIcon>;
