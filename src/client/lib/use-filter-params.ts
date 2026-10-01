import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

export type FilterParams = {
  q: string;
  workspaceId: string;
  tagIds: string[];
  from: string;
  to: string;
};

export type FilterParamsApi = {
  filters: FilterParams;
  hasActiveFilters: boolean;
  setQuery: (value: string) => void;
  setWorkspaceId: (value: string) => void;
  toggleTag: (tagId: string) => void;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  reset: () => void;
};

const DEBOUNCE_MS = 300;

export const EMPTY_FILTERS: FilterParams = {
  q: "",
  workspaceId: "",
  tagIds: [],
  from: "",
  to: "",
};

export function buildFilterQuery(
  filters: FilterParams,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  if (filters.q) query.q = filters.q;
  if (filters.workspaceId) query.workspace_id = filters.workspaceId;
  if (filters.tagIds.length > 0) query.tag_id = filters.tagIds;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  return query;
}

function readFilters(params: URLSearchParams): FilterParams {
  return {
    q: params.get("q") ?? "",
    workspaceId: params.get("workspaceId") ?? "",
    tagIds: params
      .getAll("tag")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

export function useFilterParams(): FilterParamsApi {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const [queryInput, setQueryInput] = useState(filters.q);
  const committedQueryRef = useRef(filters.q);

  useEffect(() => {
    if (filters.q !== committedQueryRef.current) {
      committedQueryRef.current = filters.q;
      setQueryInput(filters.q);
    }
  }, [filters.q]);

  useEffect(() => {
    if (queryInput === committedQueryRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      committedQueryRef.current = queryInput;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const trimmed = queryInput.trim();
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput, setSearchParams]);

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const toggleTag = (tagId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const current = next.getAll("tag");
        next.delete("tag");
        const updated = current.includes(tagId)
          ? current.filter((id) => id !== tagId)
          : [...current, tagId];
        for (const id of updated) {
          next.append("tag", id);
        }
        return next;
      },
      { replace: true },
    );
  };

  const reset = () => {
    committedQueryRef.current = "";
    setQueryInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters =
    filters.q.length > 0 ||
    filters.workspaceId.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.from.length > 0 ||
    filters.to.length > 0;

  return {
    filters: { ...filters, q: queryInput },
    hasActiveFilters,
    setQuery: setQueryInput,
    setWorkspaceId: (value) => updateParam("workspaceId", value),
    toggleTag,
    setFrom: (value) => updateParam("from", value),
    setTo: (value) => updateParam("to", value),
    reset,
  };
}
