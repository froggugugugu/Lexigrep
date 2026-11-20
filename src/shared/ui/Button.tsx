import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:opacity-90 active:opacity-80",
  secondary:
    "bg-surface-2 text-foreground border border-border hover:bg-surface active:opacity-80",
  ghost: "text-foreground hover:bg-surface-2 active:opacity-80",
  danger: "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20",
};

/* 親指操作: 最小 44px の高さ(--spacing-tap) */
const sizes: Record<Size, string> = {
  md: "min-h-tap px-4 text-sm",
  lg: "min-h-14 px-5 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}

export type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  "data-testid"?: string;
  children: ReactNode;
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full,
  className,
  "data-testid": testId,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}
