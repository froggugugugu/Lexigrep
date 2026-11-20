"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";
import { cn } from "./cn";
import { NAV_ITEMS } from "./nav-items";

/** セッションはホームから始める作業なので、ホームのタブを選択中にする */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/session");
  return pathname.startsWith(href);
}

/** 全画面で共通の主要導線。画面下に浮くアイランド形式で、親指で届く位置に置く */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主要ナビゲーション"
      className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-4"
    >
      <ul className="pointer-events-auto flex w-full max-w-sm items-stretch gap-0.5 rounded-full border border-border bg-surface/80 p-1 shadow-lg backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                  active
                    ? "bg-accent/15 font-medium text-accent"
                    : "text-muted hover:text-foreground active:bg-surface-2",
                )}
              >
                <NavIcon name={item.icon} filled={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
