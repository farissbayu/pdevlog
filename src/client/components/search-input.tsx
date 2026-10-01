import type { ComponentProps } from "react"
import { Search } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/client/components/ui/input"

type SearchInputProps = ComponentProps<"input">

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" {...props} />
    </div>
  )
}
