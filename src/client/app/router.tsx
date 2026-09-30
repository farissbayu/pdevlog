import { Navigate, createBrowserRouter } from "react-router";

import { AuthGuard } from "@/client/app/auth-guard";
import { AppLayout } from "@/client/app/layout";
import { LoginPage } from "@/client/features/auth/login-page";
import { WorkspacesPage } from "@/client/features/workspaces/workspaces-page";

function HomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="text-sm text-muted-foreground">
        This is your protected workspace. Use the sidebar to navigate.
      </p>
    </div>
  );
}

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
      { index: true, element: <HomePage /> },
      { path: "workspaces", element: <WorkspacesPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
