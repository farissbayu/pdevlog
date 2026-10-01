import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";

import { GoogleIcon } from "@/client/components/google-icon";
import { Button } from "@/client/components/ui/button";
import { meQueryOptions } from "@/client/features/auth/api";

export function LoginPage() {
  const { data, isPending } = useQuery(meQueryOptions);

  if (!isPending && data) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-4">
      <div className="space-y-2 text-center">
        <img
          src="/pdevlog-icon.png"
          alt="Personal Dev Log"
          className="mx-auto size-12 rounded-xl"
        />
        <h1 className="text-2xl font-semibold">Personal Dev Log</h1>
        <p className="text-sm text-muted-foreground">
          Log in to continue to your dev log.
        </p>
      </div>

      <Button asChild size="lg">
        <a href="/api/auth/google">
          <GoogleIcon />
          Continue with Google
        </a>
      </Button>

      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}
