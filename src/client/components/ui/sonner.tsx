import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "@/client/components/theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-center gap-2.5 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10",
          title: "font-medium",
          description: "text-muted-foreground",
          icon: "size-4 shrink-0",
          success:
            "border-emerald-500/30 [&_[data-icon]]:text-emerald-500",
          error:
            "border-destructive/30 [&_[data-icon]]:text-destructive",
          warning:
            "border-amber-500/30 [&_[data-icon]]:text-amber-500",
          info: "border-primary/30 [&_[data-icon]]:text-primary",
          actionButton:
            "ml-auto rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground",
          cancelButton:
            "ml-auto rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
          closeButton:
            "group-[.toast]:absolute group-[.toast]:top-1.5 group-[.toast]:right-1.5 group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:bg-popover group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
