import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  AdminUser,
  AdminUserListResponse,
} from "@/shared/schemas/admin";
import type { PaginationMeta } from "@/shared/schemas/pagination";

const ADMIN_KEY = ["admin"] as const;

export type AdminUserListParams = {
  q?: string;
  page?: number;
};

export type AdminUserListResult = {
  users: AdminUser[];
  pagination: PaginationMeta;
};

function buildAdminUserQuery(
  params: AdminUserListParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.q) {
    query.q = params.q;
  }
  if (params.page !== undefined) {
    query.page = String(params.page);
  }
  return query;
}

export async function fetchAdminUsers(
  params: AdminUserListParams = {},
): Promise<AdminUserListResult> {
  const response = await client.api.admin.users.$get({
    query: buildAdminUserQuery(params),
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to load users");
  }
  const data = (await response.json()) as AdminUserListResponse;
  return { users: data.users, pagination: data.pagination };
}

export async function deleteAdminUser(id: string): Promise<void> {
  const response = await client.api.admin.users[":id"].$delete({
    param: { id },
  });
  if (!response.ok) {
    throw await parseApiError(response, "Failed to delete user");
  }
}

export function adminUsersQueryOptions(params: AdminUserListParams) {
  return queryOptions({
    queryKey: [...ADMIN_KEY, "users", params],
    queryFn: () => fetchAdminUsers(params),
  });
}

export function useAdminUsersQuery(params: AdminUserListParams) {
  return useQuery(adminUsersQueryOptions(params));
}

export function useDeleteAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}
