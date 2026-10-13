import type { SourceResponse } from "@/shared/schemas/source";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";
import type { SourceRow, WorkspaceRow } from "@/worker/db/schema";

export function toSourceResponse(source: SourceRow): SourceResponse {
  return {
    id: source.id,
    url: source.url,
    label: source.label,
    kind: source.kind,
    locator: source.locator,
  };
}

export function toWorkspaceResponse(
  workspace: WorkspaceRow,
  sourceRows: SourceRow[] = [],
): WorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    type: workspace.type,
    sources: sourceRows.map(toSourceResponse),
    createdAt: new Date(workspace.createdAt).toISOString(),
    updatedAt: new Date(workspace.updatedAt).toISOString(),
  };
}
