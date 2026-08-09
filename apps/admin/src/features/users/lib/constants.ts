import type { AdminListUsersSort } from "../api/users.dto";

export const USER_TABLE_PAGE_SIZES = [10, 20, 25, 30, 40, 50] as const;

export const USER_TABLE_DEFAULT_PAGE_SIZE = 25;

export const USER_SORT_OPTIONS: readonly {
	label: string;
	value: AdminListUsersSort;
}[] = [
	{ label: "Newest first", value: "newest" },
	{ label: "Oldest first", value: "oldest" },
	{ label: "Name", value: "name" },
	{ label: "Email", value: "email" },
];
