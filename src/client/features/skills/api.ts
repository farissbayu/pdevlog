import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { client, parseApiError } from "@/client/lib/api";
import type {
  AttachEvidenceInput,
  MilestoneEvidenceResponse,
  RadarSummary,
  SkillsListResponse,
} from "@/shared/schemas/skills";

export const skillsKeys = {
  all: ["skills"] as const,
  radar: () => [...skillsKeys.all, "radar"] as const,
  list: () => [...skillsKeys.all, "list"] as const,
};

export async function fetchSkills(): Promise<SkillsListResponse> {
  const res = await client.api.skills.$get();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to fetch skills data");
  }
  return (await res.json()) as SkillsListResponse;
}

export async function fetchRadar(): Promise<{ radar: RadarSummary }> {
  const res = await client.api.skills.radar.$get();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to fetch radar summary");
  }
  return (await res.json()) as { radar: RadarSummary };
}

export async function syncGrowth(): Promise<SkillsListResponse> {
  const res = await client.api.skills.sync.$post();
  if (!res.ok) {
    throw await parseApiError(res, "Failed to sync growth audit");
  }
  return (await res.json()) as SkillsListResponse;
}

export async function unlinkEvidence(evidenceId: string): Promise<void> {
  const res = await client.api.skills.evidence[":evidenceId"].$delete({
    param: { evidenceId },
  });
  if (!res.ok) {
    throw await parseApiError(res, "Failed to unlink evidence");
  }
}

export async function attachEvidence(
  milestoneId: string,
  input: AttachEvidenceInput,
): Promise<{ evidence: MilestoneEvidenceResponse }> {
  const res = await client.api.skills.milestones[":milestoneId"].evidence.$post({
    param: { milestoneId },
    json: input,
  });
  if (!res.ok) {
    throw await parseApiError(res, "Failed to attach evidence");
  }
  return (await res.json()) as { evidence: MilestoneEvidenceResponse };
}


export const skillsQueryOptions = () =>
  queryOptions({
    queryKey: skillsKeys.list(),
    queryFn: fetchSkills,
  });

export const radarQueryOptions = () =>
  queryOptions({
    queryKey: skillsKeys.radar(),
    queryFn: fetchRadar,
  });

export function useSyncGrowthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncGrowth,
    onSuccess: (data) => {
      queryClient.setQueryData(skillsKeys.list(), data);
      queryClient.setQueryData(skillsKeys.radar(), { radar: data.radar });
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}

export function useUnlinkEvidenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkEvidence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}

export function useAttachEvidenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      input,
    }: {
      milestoneId: string;
      input: AttachEvidenceInput;
    }) => attachEvidence(milestoneId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}
