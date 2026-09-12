import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppShell } from "@/components/console/AppShell";
import { Button } from "@/components/console/primitives";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark" },
      { title: "VAIYU — Cyclone Intelligence Console" },
      {
        name: "description",
        content:
          "Tropical cyclone tracking, trained-model track and intensity forecasting, and "
          + "historical analogue analysis over the IBTrACS best-track archive.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700"
          + "&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="graticule flex h-full flex-col items-center justify-center gap-3">
      <p className="font-display text-2xl">No such screen</p>
      <p className="text-xs text-muted-foreground">
        That route does not exist in this console.
      </p>
      <Link to="/" className="mt-2">
        <Button variant="primary">Back to Mission Control</Button>
      </Link>
    </div>
  );
}

function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="graticule flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-xl">This screen failed to load</p>
      <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
        {error.message}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          variant="primary"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
        <Link to="/">
          <Button>Mission Control</Button>
        </Link>
      </div>
    </div>
  );
}
