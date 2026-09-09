import type { ReactNode } from "react";

import { TopNav } from "@/components/layout/TopNav";
import { Modals } from "@/components/dashboard/Modals";
import { DataSourceStrip } from "@/components/layout/DataSourceStrip";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-3 py-3 md:px-5 md:py-4">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3">
        <TopNav />
        <main className="flex-1">{children}</main>
        <DataSourceStrip />
      </div>
      <Modals />
    </div>
  );
}
