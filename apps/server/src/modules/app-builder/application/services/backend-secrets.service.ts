/**
 * Pushes one stored project secret to the Supabase Edge Function secrets
 * of a V2 app and stamps the push (WANDIT-186). The `set_secret` host tool
 * calls it; the connectors of WANDIT-189 call it later. It reads the value
 * through `ProjectSecretsService` and sends it through
 * `SupabaseManagementClient`. No Nest decorator: callers compose it by hand.
 */
import type { ProjectSecretsRepository } from "../../infrastructure/persistence/project-secrets.repository";
import type {
	BackendRef,
	SupabaseManagementClient,
} from "../../infrastructure/supabase/supabase-management.client";
import type { ProjectSecretsService } from "./project-secrets.service";

/** Push of one secret; the caller resolves the active backend first. */
export class BackendSecretsService {
	constructor(
		private readonly deps: {
			client: Pick<SupabaseManagementClient, "bulkCreateSecrets">;
			/** Decrypts the stored value; server code only. */
			secrets: Pick<ProjectSecretsService, "readValue">;
			secretsRepo: Pick<ProjectSecretsRepository, "markSynced">;
			/** The clock of the `synced_to_backend_at` stamp. */
			now: () => Date;
		},
	) {}

	/**
	 * Answers `missing` and calls no upstream when the project has no value
	 * of that name. An upstream or decrypt error propagates. The value
	 * leaves this method only in the bulk-create request body.
	 */
	async push(backend: BackendRef, name: string): Promise<"synced" | "missing"> {
		// The stamp time comes before the read: a value written after the read
		// is newer than the stamp, so `markSynced` leaves it unstamped.
		const readAt = this.deps.now();
		const value = await this.deps.secrets.readValue(backend.projectId, name);
		if (value === null) {
			return "missing";
		}
		await this.deps.client.bulkCreateSecrets(backend, [{ name, value }]);
		await this.deps.secretsRepo.markSynced(backend.projectId, name, readAt);
		return "synced";
	}
}
