import type React from "react";
import { BottomNav } from "@/shared/ui/BottomNav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-island">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
