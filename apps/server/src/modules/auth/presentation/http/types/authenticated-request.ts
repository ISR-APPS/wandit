import type { AuthSession, AuthUser } from "@wandit/auth";
import type { FastifyRequest } from "fastify";

export type AuthenticatedRequest = FastifyRequest & {
	session: AuthSession;
	user: AuthUser;
};

export type MaybeAuthenticatedRequest = FastifyRequest &
	Partial<Pick<AuthenticatedRequest, "session" | "user">>;
