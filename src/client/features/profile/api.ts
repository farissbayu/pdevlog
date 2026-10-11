import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  AnalyzeSkillsResponse,
  CvUploadResponse,
  SyncCvSkillsResponse,
  UpdateProfileRequest,
  UserProfileResponse,
} from "@/shared/schemas/profile";

export const profileKeys = {
  all: ["profile"] as const,
  detail: () => [...profileKeys.all, "detail"] as const,
};

export async function fetchProfile(): Promise<UserProfileResponse> {
  const res = await client.api.profile.$get();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to fetch profile");
  }
  return (await res.json()) as UserProfileResponse;
}

function isProcessing(profile?: UserProfileResponse): boolean {
  return (
    profile?.cvParseStatus === "processing" ||
    profile?.cvAuditStatus === "auditing" ||
    profile?.insightsStatus === "analyzing"
  );
}

export const profileQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.detail(),
    queryFn: fetchProfile,
    refetchInterval: (query) =>
      isProcessing(query.state.data) ? 2500 : false,
  });

export async function updateProfile(
  input: UpdateProfileRequest,
): Promise<UserProfileResponse> {
  const res = await client.api.profile.$patch({
    json: input,
  });
  if (!res.ok) {
    throw await parseApiError(res, "Failed to update profile");
  }
  return (await res.json()) as UserProfileResponse;
}

export async function uploadCvFile(file: File): Promise<CvUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/profile/cv/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw await parseApiError(res, "Failed to upload and extract CV");
  }

  return (await res.json()) as CvUploadResponse;
}

export async function syncCvSkills(): Promise<SyncCvSkillsResponse> {
  const res = await client.api.profile.cv["sync-skills"].$post();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to sync skill mastery from CV");
  }
  return (await res.json()) as SyncCvSkillsResponse;
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.detail(), data);
    },
  });
}

export function useUploadCvMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadCvFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export async function analyzeSkills(): Promise<AnalyzeSkillsResponse> {
  const res = await client.api.profile.skills.analyze.$post();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to analyze engineering skills");
  }
  return (await res.json()) as AnalyzeSkillsResponse;
}

export function useAnalyzeSkillsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: analyzeSkills,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export async function extractPersonaFromCv(): Promise<UserProfileResponse> {
  const res = await client.api.profile.persona.extract.$post();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to extract persona details from CV");
  }
  return (await res.json()) as UserProfileResponse;
}

export function useExtractPersonaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: extractPersonaFromCv,
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.detail(), data);
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

