import * as React from "react";
import {
  Frame,
  Map,
  PieChart,
  LifeBuoy,
  Send,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { NavProjects } from "~/components/nav-projects";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import { Link } from "react-router";

export function AppSidebar({
  sessonClaims,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessonClaims: { fullName: string; imageUrl: string; email: string };
}) {
  return (
    <Sidebar collapsible="icon" {...props} className="">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/chat">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <MessageCircle className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Chat AI</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <Link to="/settings">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Settings2 className="size-4" /> Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Link>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
