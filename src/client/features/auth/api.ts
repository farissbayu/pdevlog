import { useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { client } from "@/client/lib/api";
import type { MeResponse } from "@/shared/schemas/auth";

export async function fetchMe(): Promise<MeResponse> {
  const response = await client.api.auth.me.$get();
  if (!response.ok) {
    throw new Error("Not authenticated");
  }
  return (await response.json()) as MeResponse;
}

export async function logout(): Promise<void> {
  const response = await client.api.auth.logout.$post();
  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

export const meQueryOptions = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: fetchMe,
  retry: false,
  staleTime: 60_000,
});

export function useLogoutMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
