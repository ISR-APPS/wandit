import { floorCreditBalance, roundCreditAmount } from "@/lib/credit-format";

import type { AdminUserSummary, ListUsersParams } from "../api/users.dto";
import { listUsers } from "../api/users.services";
import { getRoleLabel } from "../components/detail/user-detail-helpers";

/**
 * Contract ceiling from paginationQuerySchema (pageSize.max(100)). Pages are
 * fetched one after another — never in parallel — so a large export walks the
 * API politely instead of hammering it.
 */
export const USERS_EXPORT_PAGE_SIZE = 100;

/** The current filter set, minus the table's own pagination. */
export type UsersExportFilters = Omit<ListUsersParams, "page" | "pageSize">;

type FetchUsersPage = typeof listUsers;

export async function fetchAllFilteredUsers(
	filters: UsersExportFilters,
	fetchPage: FetchUsersPage = listUsers,
): Promise<AdminUserSummary[]> {
	const users: AdminUserSummary[] = [];
	let page = 1;
	let total = Number.POSITIVE_INFINITY;

	while (users.length < total) {
		const result = await fetchPage({
			...filters,
			page,
			pageSize: USERS_EXPORT_PAGE_SIZE,
		});

		total = result.total;

		// An empty page before reaching total means rows disappeared mid-export
		// (deletes, filter drift) — stop instead of looping forever.
		if (result.items.length === 0) {
			break;
		}

		users.push(...result.items);
		page += 1;
	}

	return users;
}

export const USERS_EXPORT_COLUMNS = [
	{ header: "Name", width: 28 },
	{ header: "Email", width: 32 },
	{ header: "Phone", width: 16 },
	{ header: "Country", width: 10 },
	{ header: "Verified", width: 10 },
	{ header: "Role", width: 10 },
	{ header: "Status", width: 10 },
	{ header: "Plan", width: 12 },
	{ header: "Credit balance", width: 15 },
	{ header: "Credits used", width: 13 },
	{ header: "Projects", width: 10 },
	{ header: "Signed up", width: 26 },
	{ header: "Last seen", width: 26 },
] as const;

/** One worksheet row per user, in USERS_EXPORT_COLUMNS order. */
export function buildUsersExportRow(
	user: AdminUserSummary,
): (string | number)[] {
	return [
		user.name,
		user.email,
		user.phone ?? "",
		user.countryCode ?? "",
		user.emailVerified ? "Yes" : "No",
		getRoleLabel(user.role),
		user.banned ? "banned" : "active",
		user.plan,
		// Same display rules as the table: floor the balance to one decimal
		// (never export more than the user has), keep charges exact at 2 dp.
		floorCreditBalance(user.creditsBalance),
		roundCreditAmount(user.creditsConsumed),
		user.projectsCount,
		// Contract timestamps are already ISO 8601 strings — pass them through.
		user.createdAt,
		user.lastSeenAt ?? "",
	];
}

export function usersExportFileName(now = new Date()): string {
	return `wandit-users-${now.toISOString().slice(0, 10)}.xlsx`;
}

/**
 * Fetches every page of the current filter set, builds a real .xlsx in the
 * browser, and triggers the download. exceljs loads on demand so it stays out
 * of the main bundle.
 */
export async function exportUsersToExcel(
	filters: UsersExportFilters,
): Promise<void> {
	const users = await fetchAllFilteredUsers(filters);
	const { Workbook } = await import("exceljs");
	const workbook = new Workbook();
	const sheet = workbook.addWorksheet("Users");

	sheet.columns = USERS_EXPORT_COLUMNS.map((column) => ({
		header: column.header,
		width: column.width,
	}));
	sheet.getRow(1).font = { bold: true };

	for (const user of users) {
		sheet.addRow(buildUsersExportRow(user));
	}

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
	const url = URL.createObjectURL(blob);

	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = usersExportFileName();
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	} finally {
		URL.revokeObjectURL(url);
	}
}
