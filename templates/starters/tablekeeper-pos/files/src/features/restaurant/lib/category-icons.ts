// The icon of each menu category. The app shows no food photos, so a dish tile shows the icon of its category.
// The till screen, the menu table, the sales home, and the day report read it from ~/features/restaurant.
import {
	BowlFoodIcon,
	CakeIcon,
	CarrotIcon,
	CookingPotIcon,
	type Icon,
	PintGlassIcon,
} from "@phosphor-icons/react";
import type { MenuCategory } from "./sample-menu";

/** One Phosphor icon per category of the printed menu. */
export const MENU_CATEGORY_ICON = {
	starters: BowlFoodIcon,
	mains: CookingPotIcon,
	sides: CarrotIcon,
	desserts: CakeIcon,
	// A plain glass, because the drinks hold wine, beer, coffee, tea, and juice.
	drinks: PintGlassIcon,
} satisfies Record<MenuCategory, Icon>;
