import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
import { cn } from "cn";

import {
  Table as TablePrimitive,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  visibility?: VisibilityState;
  onVisibilityChange?: (visibility: VisibilityState) => void;
  className?: string;
  toolbar?: (table: Table<TData>) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  visibility,
  onVisibilityChange,
  className,
  toolbar,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility: visibility ?? {} },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      if (!onVisibilityChange) {
        return;
      }
      const next =
        typeof updater === "function"
          ? updater(visibility ?? {})
          : updater;
      onVisibilityChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {toolbar ? (
        <div className="flex items-center justify-end border-b px-3 py-2">
          {toolbar(table)}
        </div>
      ) : null}
      <div className="matcha-scroll max-h-[65svh] overflow-auto">
        <TablePrimitive>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </TablePrimitive>
      </div>
    </div>
  );
}
