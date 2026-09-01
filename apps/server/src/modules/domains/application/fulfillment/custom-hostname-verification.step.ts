export type CustomHostnameVerificationResult =
	| {
			hostnameStatus: string | null;
			sslStatus: string | null;
			status: "active" | "pending";
	  }
	| { error: unknown; status: "transient" };

type CustomHostnameStatusProvider = {
	getCustomHostnameStatus(id: string): Promise<{
		hostnameStatus: string | null;
		sslStatus: string | null;
	}>;
};

export class CustomHostnameVerificationStep {
	constructor(private readonly provider: CustomHostnameStatusProvider) {}

	async execute(id: string): Promise<CustomHostnameVerificationResult> {
		try {
			const result = await this.provider.getCustomHostnameStatus(id);
			const fullyActive =
				result.hostnameStatus === "active" && result.sslStatus === "active";

			return {
				hostnameStatus: result.hostnameStatus,
				sslStatus: result.sslStatus,
				status: fullyActive ? "active" : "pending",
			};
		} catch (error) {
			return { error, status: "transient" };
		}
	}
}
