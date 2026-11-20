import { cn } from "./cn";

export function ProgressBar({
  value,
  label,
  className,
}: {
  /** 0〜1 */
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
