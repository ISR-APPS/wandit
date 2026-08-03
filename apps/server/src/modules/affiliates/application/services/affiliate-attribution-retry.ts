export type AffiliateAttributionRetryPayload = {
	source: "signup_body" | "signup_cookie";
	token: string;
	userId: string;
};
