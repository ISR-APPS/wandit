/**
 * Mutations of the Cloud tab (WANDIT-188). Each one calls a service of
 * cloud.services.ts and puts its answer where the tab reads it. Called by
 * components/cloud/backend-state.tsx, sql-editor.tsx, storage-panel.tsx,
 * and secrets-panel.tsx. The last parameter of each hook is the service,
 * so a spec injects a fake.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CloudSqlBody } from "@wandit/contracts";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { cloudKeys } from "./cloud.queries";
import {
	deleteObjects,
	deleteSecret,
	enableBackend,
	restoreBackend,
	runSql,
	setSecret,
	uploadObject,
} from "./cloud.services";

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

/**
 * Uploads one file of the Storage panel to a path of `bucket`. Every loaded
 * folder of the bucket reads again, so the new file shows in its folder.
 */
export function useUploadObject(
	projectId: string,
	bucket: string,
	upload: typeof uploadObject = uploadObject,
) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	return useMutation({
		mutationKey: [...cloudKeys.bucketObjects(projectId, bucket), "upload"],
		mutationFn: (input: { path: string; file: File }) =>
			upload(projectId, bucket, input),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: cloudKeys.bucketObjects(projectId, bucket),
			});
		},
		onError: (error) => {
			// The upload URL comes from the API. The file goes to Supabase
			// Storage, and its refusal has no API error code.
			toast.error(
				isApiClientError(error)
					? getApiErrorMessage(error)
					: t("workspace.cloud.storage.upload.failed"),
			);
		},
	});
}

/** Deletes files of the Storage panel. Every loaded folder of the bucket reads again. */
export function useDeleteObjects(
	projectId: string,
	bucket: string,
	remove: typeof deleteObjects = deleteObjects,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.bucketObjects(projectId, bucket), "delete"],
		mutationFn: (paths: string[]) => remove(projectId, bucket, { paths }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: cloudKeys.bucketObjects(projectId, bucket),
			});
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/**
 * Sets or replaces one secret value. The list reads again for the new dates.
 * The mutation cache drops the value at once after the mutation ends.
 */
export function useSetSecret(
	projectId: string,
	set: typeof setSecret = setSecret,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.secrets(projectId), "set"],
		// The variables hold the secret value. A cache time of 0 removes them
		// as soon as no component observes the mutation.
		gcTime: 0,
		mutationFn: (input: { name: string; value: string }) =>
			set(projectId, input.name, { value: input.value }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: cloudKeys.secrets(projectId),
			});
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}

/** Deletes one `user` secret. The list reads again. */
export function useDeleteSecret(
	projectId: string,
	remove: typeof deleteSecret = deleteSecret,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...cloudKeys.secrets(projectId), "delete"],
		mutationFn: (name: string) => remove(projectId, name),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: cloudKeys.secrets(projectId),
			});
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}
