import { Navigate, createBrowserRouter } from "react-router";

import { AuthGuard } from "@/client/app/auth-guard";
import { AppLayout } from "@/client/app/layout";
import { LoginPage } from "@/client/features/auth/login-page";
import { BragLogDetailPage } from "@/client/features/brag-logs/brag-log-detail-page";
import { BragLogsPage } from "@/client/features/brag-logs/brag-logs-page";
import { DashboardPage } from "@/client/features/dashboard/dashboard-page";
import { LandingPage } from "@/client/features/landing/landing-page";
import { NoteDetailPage } from "@/client/features/notes/note-detail-page";
import { NoteEditorPage } from "@/client/features/notes/note-editor";
import { NotesPage } from "@/client/features/notes/notes-page";
import { SettingsPage } from "@/client/features/settings/settings-page";
import { SparksPage } from "@/client/features/sparks/sparks-page";
import { TagsPage } from "@/client/features/tags/tags-page";
import { WorkspaceDetailPage } from "@/client/features/workspaces/workspace-detail-page";
import { WorkspacesPage } from "@/client/features/workspaces/workspaces-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "workspaces", element: <WorkspacesPage /> },
      { path: "workspaces/:id", element: <WorkspaceDetailPage /> },
      { path: "brag-logs", element: <BragLogsPage /> },
      { path: "brag-logs/:id", element: <BragLogDetailPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "notes/new", element: <NoteEditorPage /> },
      { path: "notes/:id", element: <NoteDetailPage /> },
      { path: "notes/:id/edit", element: <NoteEditorPage /> },
      { path: "sparks", element: <SparksPage /> },
      { path: "tags", element: <TagsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
