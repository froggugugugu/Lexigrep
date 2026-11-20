import { cn } from "./cn";

export const REPOSITORY_URL = "https://github.com/froggugugugu/Lexigrep";
const BLUEPRINTS_URL = "https://github.com/froggugugugu/project-blueprints";

const linkClass =
  "underline decoration-border underline-offset-4 hover:text-foreground " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** 著作権・ライセンス・開発の枠組み(project-blueprints)の表記。画面の最下部に置く */
export function SiteCredit({ className }: { className?: string }) {
  return (
    <p
      data-testid="site-credit"
      className={cn("text-[11px] leading-5 text-muted", className)}
    >
      © 2026 froggugugugu. MIT License. Built with{" "}
      <a
        href={BLUEPRINTS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        project-blueprints
      </a>
      .
    </p>
  );
}
