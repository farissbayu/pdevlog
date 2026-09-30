import { Navigate, createBrowserRouter } from "react-router";

import { AuthGuard } from "@/client/app/auth-guard";
import { AppLayout } from "@/client/app/layout";
import { LoginPage } from "@/client/features/auth/login-page";
import { BragLogDetailPage } from "@/client/features/brag-logs/brag-log-detail-page";
import { BragLogsPage } from "@/client/features/brag-logs/brag-logs-page";
import { DashboardPage } from "@/client/features/dashboard/dashboard-page";
import { TagsPage } from "@/client/features/tags/tags-page";
import { WorkspaceDetailPage } from "@/client/features/workspaces/workspace-detail-page";
import { WorkspacesPage } from "@/client/features/workspaces/workspaces-page";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "workspaces", element: <WorkspacesPage /> },
      { path: "workspaces/:id", element: <WorkspaceDetailPage /> },
      { path: "brag-logs", element: <BragLogsPage /> },
      { path: "brag-logs/:id", element: <BragLogDetailPage /> },
      { path: "tags", element: <TagsPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
