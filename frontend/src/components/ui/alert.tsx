import * as React from "react";

import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
