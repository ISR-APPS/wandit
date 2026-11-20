// Public surface of the trophies feature. Pages are never exported from barrels.

// Query keys and the query of the trophies of the session user. The credits chip reads the level.
export { trophiesKeys, useTrophiesQuery } from "./api/trophies.queries";
// One trophy as a keycap tile. Pure, so the signed-out /pricing page can render it.
export { TrophyMedallion } from "./components/trophy-medallion";
// The level, the points, and the 3 nearest trophies, for the wallet page.
export { TrophySummaryCard } from "./components/trophy-summary-card";
// The unlock toasts. The `_auth` layout mounts it one time.
export { TrophyUnlockToaster } from "./components/trophy-unlock-toaster";
