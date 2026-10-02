import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  Loader2,
  Mail,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { DatePicker } from "@/client/components/date-picker";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { meQueryOptions } from "@/client/features/auth/api";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountSchema,
} from "@/shared/schemas/settings";

import { useDeleteAccountMutation, useExportBragLogs } from "./api";

function getInitials(name: string, email: string): string {
  const source = name.trim() || email;
  return source.slice(0, 1).toUpperCase();
}

export function SettingsPage() {
  const { data, isPending } = useQuery(meQueryOptions);
  const exportMutation = useExportBragLogs();
  const deleteMutation = useDeleteAccountMutation();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const user = data?.user;
  const rangeError =
    from && to && from > to ? "The start date must be before the end date." : null;
  const isConfirmed = deleteAccountSchema.safeParse({ confirmation }).success;

  const handleExport = () => {
    if (rangeError) {
      return;
    }
    exportMutation.mutate({
      from: from || undefined,
      to: to || undefined,
    });
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setConfirmation("");
    }
  };

  const handleDelete = () => {
    if (!isConfirmed) {
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Settings className="size-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and account data.
        </p>
      </div>

      {isPending ? (
        <div className="h-32 animate-pulse rounded-lg border bg-card" />
      ) : null}

      {!isPending && user ? (
        <>
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-medium">Profile</h2>
              <p className="text-sm text-muted-foreground">
                Your Google account information.
              </p>
            </div>
            <div className="flex items-center gap-4 p-5">
              <Avatar size="lg" className="size-14">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback className="text-lg">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{user.name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-medium">Export data</h2>
              <p className="text-sm text-muted-foreground">
                Download your brag logs as a Markdown file in STAR format.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="export-from">
                    <CalendarDays className="size-3.5" />
                    From
                  </Label>
                  <DatePicker
                    id="export-from"
                    value={from}
                    onChange={setFrom}
                    placeholder="From date"
                    className="w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-to">
                    <CalendarDays className="size-3.5" />
                    To
                  </Label>
                  <DatePicker
                    id="export-to"
                    value={to}
                    onChange={setTo}
                    placeholder="To date"
                    className="w-40"
                  />
                </div>
                <Button
                  onClick={handleExport}
                  disabled={
                    exportMutation.isPending || Boolean(rangeError)
                  }
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Export to Markdown (.md)
                </Button>
              </div>

              {rangeError ? (
                <p className="text-sm text-destructive">{rangeError}</p>
              ) : null}

              {exportMutation.isError ? (
                <p className="text-sm text-destructive">
                  Export failed. Please try again.
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Leave both dates empty to export every brag log.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-destructive/40 bg-card">
            <div className="border-b border-destructive/20 px-5 py-4">
              <h2 className="flex items-center gap-2 font-medium text-destructive">
                <ShieldAlert className="size-4" />
                Danger zone
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <p className="max-w-md text-sm text-muted-foreground">
                Permanently delete your account along with every workspace,
                tag, brag log, and note you own. This action cannot be
                undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setDialogOpen(true)}
              >
                Delete account
              </Button>
            </div>
          </section>
        </>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all of its data. Type{" "}
              <span className="font-mono font-semibold text-foreground">
                {DELETE_ACCOUNT_CONFIRMATION}
              </span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">Confirmation</Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={DELETE_ACCOUNT_CONFIRMATION}
              autoComplete="off"
            />
          </div>

          {deleteMutation.isError ? (
            <p className="text-sm text-destructive">
              Failed to delete account. Please try again.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
