import {
	changeMockUserRole,
	getMockUser,
	grantMockUserCredits,
	listMockUsers,
	setMockUserBanned,
} from "../lib/mock-users";
import type {
	ChangeUserRoleInput,
	GrantUserCreditsInput,
	SetUserBannedInput,
	UserDetail,
	UserSummary,
} from "./users.dto";

const MOCK_LATENCY_MS = 180;

export async function listUsers(): Promise<UserSummary[]> {
	await mockLatency();
	return listMockUsers();
}

export async function getUser(userId: string): Promise<UserDetail> {
	await mockLatency();
	return getMockUser(userId);
}

export async function grantUserCredits({
	userId,
	amount,
	reason,
}: GrantUserCreditsInput): Promise<UserDetail> {
	await mockLatency();
	return grantMockUserCredits(userId, amount, reason);
}

export async function changeUserRole({
	userId,
	role,
}: ChangeUserRoleInput): Promise<UserDetail> {
	await mockLatency();
	return changeMockUserRole(userId, role);
}

export async function setUserBanned({
	userId,
	banned,
	reason,
}: SetUserBannedInput): Promise<UserDetail> {
	await mockLatency();
	return setMockUserBanned(userId, banned, reason);
}

function mockLatency() {
	return new Promise<void>((resolve) => {
		globalThis.setTimeout(resolve, MOCK_LATENCY_MS);
	});
}
