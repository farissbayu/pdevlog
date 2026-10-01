import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { client, parseApiError } from "@/client/lib/api";
import type { ExportLogsQuery } from "@/shared/schemas/settings";

export async function exportBragLogs(query: ExportLogsQuery): Promise<void> {
  const response = await client.api.export["brag-logs"].$get({ query });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to export brag logs");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "brag-logs.md";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function deleteAccount(): Promise<void> {
  const response = await client.api.auth.account.$delete();
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete account");
  }
}

export function useExportBragLogs() {
  return useMutation({
    mutationFn: exportBragLogs,
  });
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
