// The service rule of the fleet: when a service counts as "due soon".
// The fleet page counts the vehicles with it. The vehicle card and the vehicle panel color the service day with it.

/** A service in this count of days or less is "due soon". Two weeks give the workshop time to plan it. */
export const SERVICE_SOON_DAYS = 14;

/** The state of the next service: overdue (a past day), soon (in SERVICE_SOON_DAYS or less), or later. */
export function serviceStateOf(
	serviceInDays: number,
): "overdue" | "soon" | "later" {
	if (serviceInDays < 0) {
		return "overdue";
	}
	return serviceInDays <= SERVICE_SOON_DAYS ? "soon" : "later";
}
