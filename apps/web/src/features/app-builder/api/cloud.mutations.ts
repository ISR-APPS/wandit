/**
 * Mutations of the Cloud tab (WANDIT-188). Each one calls a service of
 * cloud.services.ts and puts its answer where the tab reads it. Called by
 * components/cloud/backend-state.tsx and components/cloud/sql-editor.tsx.
 * The last parameter of each hook is the service, so a spec injects a fake.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CloudSqlBody } from "@wandit/contracts";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { cloudKeys } from "./cloud.queries";
import { enableBackend, restoreBackend, runSql } from "./cloud.services";

/**
 * Creates the backend of the project. The `creating` answer goes into the
 * backend key, so the tab shows the wait block and the poll starts at once.
 */
export function useEnableBackend(
	projectId: string,
	enable: typeof enableBackend = enableBackend,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.backend(projectId), "enable"],
		mutationFn: () => enable(projectId),
		onSuccess: (backend) => {
			queryClient.setQueryData(cloudKeys.backend(projectId), backend);
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/**
 * Wakes a paused backend. The `restoring` answer goes into the backend key,
 * so the tab shows the wait block and the poll starts at once.
 */
export function useRestoreBackend(
	projectId: string,
	restore: typeof restoreBackend = restoreBackend,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.backend(projectId), "restore"],
		mutationFn: () => restore(projectId),
		onSuccess: (backend) => {
			queryClient.setQueryData(cloudKeys.backend(projectId), backend);
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/**
 * Runs one console statement. The result stays in the mutation `data`: no
 * query key holds console results. 409 `WRITE_NEEDS_CONFIRM` shows no
 * toast, because the SQL editor opens its confirm dialog on that code.
 */
export function useRunSql(projectId: string, run: typeof runSql = runSql) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.all(projectId), "sql"],
		mutationFn: (body: CloudSqlBody) => run(projectId, body),
		onSuccess: (result) => {
			// A write can change rows, columns, or whole tables. The tables key
			// covers the list and every loaded page.
			if (result.kind === "write") {
				void queryClient.invalidateQueries({
					queryKey: cloudKeys.tables(projectId),
				});
			}
		},
		onError: (error) => {
			if (isApiClientError(error) && error.code === "WRITE_NEEDS_CONFIRM") {
				return;
			}
			toast.error(getApiErrorMessage(error));
		},
	});
}
