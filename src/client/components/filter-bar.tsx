import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { cn } from "cn";

import { DatePicker } from "@/client/components/date-picker";
import { SearchInput } from "@/client/components/search-input";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import type { FilterParamsApi } from "@/client/lib/use-filter-params";
import { UNASSIGNED_WORKSPACE } from "@/client/lib/use-filter-params";
import type { TagResponse } from "@/shared/schemas/tag";
import type { WorkspaceResponse } from "@/shared/schemas/workspace";

type FilterBarProps = {
  api: FilterParamsApi;
  tags: TagResponse[];
  workspaces?: WorkspaceResponse[];
  searchPlaceholder?: string;
};

export function FilterBar({
  api,
  tags,
  workspaces,
  searchPlaceholder = "Search...",
}: FilterBarProps) {
  const { filters, hasActiveFilters } = api;
  const selectedWorkspace = workspaces?.find(
    (workspace) => workspace.id === filters.workspaceId,
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={api.query}
          onChange={(event) => api.setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="min-w-[200px] flex-1"
        />

        {workspaces ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="justify-between">
                {filters.workspaceId === UNASSIGNED_WORKSPACE
                  ? "Unassigned"
                  : selectedWorkspace
                    ? selectedWorkspace.name
                    : "All workspaces"}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.workspaceId === ""}
                onSelect={() => api.setWorkspaceId("")}
              >
                All workspaces
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.workspaceId === UNASSIGNED_WORKSPACE}
                onSelect={() => api.setWorkspaceId(UNASSIGNED_WORKSPACE)}
              >
                Unassigned
              </DropdownMenuCheckboxItem>
              {workspaces.map((workspace) => (
                <DropdownMenuCheckboxItem
                  key={workspace.id}
                  checked={filters.workspaceId === workspace.id}
                  onSelect={() => api.setWorkspaceId(workspace.id)}
                >
                  {workspace.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between">
              {filters.tagIds.length > 0
                ? `Tags (${filters.tagIds.length})`
                : "All tags"}
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tags.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No tags yet
              </div>
            ) : (
              tags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={filters.tagIds.includes(tag.id)}
                  onSelect={(event) => {
                    event.preventDefault();
                    api.toggleTag(tag.id);
                  }}
                >
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters ? (
          <Button variant="ghost" onClick={api.reset}>
            <X className="size-4" />
            Reset
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="size-4" />
          Date range
        </span>
        <DatePicker
          value={filters.from}
          onChange={api.setFrom}
          placeholder="From date"
          className="h-8 w-40"
        />
        <span className="text-muted-foreground">to</span>
        <DatePicker
          value={filters.to}
          onChange={api.setTo}
          placeholder="To date"
          className="h-8 w-40"
        />
      </div>

      {filters.tagIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filters.tagIds.map((tagId) => {
            const tag = tags.find((item) => item.id === tagId);
            return (
              <button
                key={tagId}
                type="button"
                onClick={() => api.toggleTag(tagId)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
                  "hover:bg-muted/70",
                )}
              >
                {tag ? tag.name : tagId}
                <Check className="size-3" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
