import type { WorkspaceResponse } from "@/shared/schemas/workspace";

import { WorkspaceTypeBadge } from "./workspace-type-badge";

export function StandaloneBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Standalone
    </span>
  );
}

export function WorkspaceLabel({
  workspace,
}: {
  workspace: WorkspaceResponse | null;
}) {
  if (!workspace) {
    return <StandaloneBadge />;
  }
  return (
    <>
      <WorkspaceTypeBadge type={workspace.type} />
      <span className="truncate">{workspace.name}</span>
    </>
  );
}
