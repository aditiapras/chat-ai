import { AppSidebar } from "~/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect } from "react-router";
import { ClerkLoading, ClerkLoaded, UserButton } from "@clerk/react-router";
import { Skeleton } from "~/components/ui/skeleton";

export async function loader(args: Route.LoaderArgs) {
  const { userId, sessionClaims } = await getAuth(args);

  if (!userId) {
    return redirect("/sign-in");
  }

  return {
    userId,
    sessionClaims: {
      firstName: sessionClaims.firstName,
    },
  };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="border border-neutral-200 peer-data-[variant=inset]:-m-2 peer-data-[variant=inset]:border-none peer-data-[variant=inset]:shadow-none">
        <header className="flex h-16 shrink-0 items-center gap-2 justify-between">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex items-center gap-2 px-4 text-sm font-medium">
            Hi, {loaderData.sessionClaims.firstName}
            <ClerkLoading>
              <Skeleton className="size-7 rounded-full" />
            </ClerkLoading>
            <ClerkLoaded>
              <UserButton />
            </ClerkLoaded>
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
