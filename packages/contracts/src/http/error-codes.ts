import { z } from "zod";

export const apiErrorCodes = [
	"AUTH_FAILURE",
	"NETWORK_ERROR",
	"CLIENT_ERROR",
	"VALIDATION_ERROR",
	"NOT_FOUND",
	"FORBIDDEN",
	"RATE_LIMITED",
	"INTERNAL_ERROR",
	"HTTP_400",
	"HTTP_401",
	"HTTP_403",
	"HTTP_404",
	"HTTP_429",
	"HTTP_500",
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
