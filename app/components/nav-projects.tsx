import { Loader2, MoreHorizontal, TextCursor, Trash } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { Link, useLoaderData, useRevalidator } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

interface LoaderData {
  menu: {
    id: string;
    title: string;
  }[];
}

export function NavProjects() {
  const { isMobile } = useSidebar();
  const loaderData = useLoaderData<LoaderData>();
  const { revalidate } = useRevalidator();
  const [hasActiveChat, setHasActiveChat] = useState(false);

  // Check if we're in a chat thread
  useEffect(() => {
    const checkForActiveChat = () => {
      const path = window.location.pathname;
      setHasActiveChat(path.startsWith("/chat/") && path.length > 6);
    };

    // Check on mount
    checkForActiveChat();
  }, []);

  // Conditionally revalidate if there are still "New Chat" titles
  useEffect(() => {
    if (hasActiveChat && loaderData?.menu) {
      // Check if any thread still has the default "New Chat" title
      const hasNewChatTitle = loaderData.menu.some(
        (item) => item.title === "New Chat"
      );

      if (hasNewChatTitle) {
        // Revalidate to get updated titles
        const timer = setTimeout(() => {
          revalidate();
        }, 1500); // Small delay to ensure title generation is complete

        return () => clearTimeout(timer);
      }
    }
  }, [hasActiveChat, loaderData, revalidate]);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Threads</SidebarGroupLabel>
      <SidebarMenu>
        {loaderData?.menu?.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton>
              <span>Belum ada threads</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {loaderData?.menu?.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild>
              <Link to={`/chat/${item.id}`}>
                <span>
                  {item.title === "New Chat" ? (
                    <div className="flex items-center">
                      <span className="mr-2">New Chat</span>
                      <Loader2 className="size-4 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    item.title
                  )}
                </span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <TextCursor />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive">
                  <Trash />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
