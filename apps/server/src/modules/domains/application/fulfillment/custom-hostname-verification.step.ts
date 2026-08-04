export type CustomHostnameVerificationResult =
	| { status: "active" }
	| { status: "pending" }
	| { error: unknown; status: "transient" };

type CustomHostnameStatusProvider = {
	getCustomHostnameStatus(id: string): Promise<{ status: string }>;
};

export class CustomHostnameVerificationStep {
	constructor(private readonly provider: CustomHostnameStatusProvider) {}

	async execute(id: string): Promise<CustomHostnameVerificationResult> {
		try {
			const result = await this.provider.getCustomHostnameStatus(id);

			return result.status === "active"
				? { status: "active" }
				: { status: "pending" };
		} catch (error) {
			return { error, status: "transient" };
		}
	}
}
