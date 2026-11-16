import { and, eq } from "drizzle-orm";

import type { Database } from "@/worker/db";
import {
  projects,
  workspaces,
  type ProjectRow,
  type WorkspaceRow,
} from "@/worker/db/schema";

export async function loadWorkspace(
  db: Database,
  workspaceId: string | null,
  userId: string,
): Promise<WorkspaceRow | null> {
  if (!workspaceId) {
    return null;
  }
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  return workspace ?? null;
}

export async function validateWorkspaceOwnership(
  db: Database,
  workspaceId: string | null | undefined,
  userId: string,
): Promise<boolean> {
  if (workspaceId === null || workspaceId === undefined) {
    return true;
  }
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  return Boolean(workspace);
}

export function touchWorkspaceStatement(
  db: Database,
  workspaceId: string,
  userId: string,
  now: Date,
) {
  return db
    .update(workspaces)
    .set({ updatedAt: now })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)));
}

export async function findOwnedProject(
  db: Database,
  projectId: string,
  userId: string,
): Promise<ProjectRow | undefined> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project;
}

export async function loadProject(
  db: Database,
  projectId: string | null,
  userId: string,
): Promise<ProjectRow | null> {
  if (!projectId) {
    return null;
  }
  return (await findOwnedProject(db, projectId, userId)) ?? null;
}

export function touchProjectStatement(
  db: Database,
  projectId: string,
  userId: string,
  now: Date,
) {
  return db
    .update(projects)
    .set({ updatedAt: now })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}
