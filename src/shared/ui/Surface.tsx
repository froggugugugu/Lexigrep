import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/** カード状の面。情報密度を優先し、余白と階層で読ませる */
export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-4",
        className,
      )}
      {...props}
    />
  );
}
