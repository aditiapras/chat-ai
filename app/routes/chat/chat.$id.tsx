import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Globe, Paperclip, Send, Square } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "~/components/ui/select";
import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Route } from "./+types/chat.$id";
import { Loader2 } from "lucide-react";
import { prisma } from "~/lib/prisma";
import { getAuth } from "@clerk/react-router/ssr.server";
import { useLocation } from "react-router";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";

export const meta: Route.MetaFunction = ({ data }) => {
  return [
    {
      title: data?.thread?.title,
      description: "Chat with AI",
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const { request, params } = args;
  const { userId } = await getAuth(args);

  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Parallel database queries for better performance
  const [model, thread] = await Promise.all([
    prisma.aIModel.findMany({
      select: {
        name: true,
        code: true,
        hasReasoning: true,
      },
      where: {
        isActive: true, // Only fetch active models
      },
    }),
    prisma.thread.findFirst({
      where: {
        id: params.id,
        userId: userId, // ✅ CRITICAL: Enforce thread ownership
      },
      include: {
        Message: {
          orderBy: {
            createdAt: "asc",
          },
          take: 50, // ✅ PERFORMANCE: Limit initial message load
          select: {
            id: true,
            content: true,
            role: true,
            model: true,
            createdAt: true,
            attachments: true,
          },
        },
      },
    }),
  ]);

  if (!thread) {
    throw new Response("Thread not found or access denied", { status: 404 });
  }

  const isInitial = thread.Message.length === 0;
  const lastModel =
    thread.Message.length > 0
      ? thread.Message[thread.Message.length - 1].model
      : thread.model;

  return { model, thread, isInitial, lastModel };
}

export default function ChatId({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const hasProcessedInitial = useRef(false);
  const [model, setModel] = useState(
    loaderData.lastModel || "openai/gpt-oss-120b"
  );

  // Check if current model supports reasoning
  const currentModelInfo = loaderData.model.find((m) => m.code === model);
  const supportsReasoning = currentModelInfo?.hasReasoning || false;

  // Convert database messages to useChat format with reasoning support (memoized for performance)
  const initialMessages = useMemo(
    () =>
      loaderData.thread?.Message.map((message) => {
        const baseMessage: any = {
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          createdAt: message.createdAt,
        };

        // Extract reasoning from attachments if available
        if (message.attachments && message.attachments.length > 0) {
          try {
            const reasoningAttachment = message.attachments.find(
              (attachment: string) => {
                try {
                  const parsed = JSON.parse(attachment);
                  return parsed.type === "reasoning";
                } catch {
                  return false;
                }
              }
            );

            if (reasoningAttachment) {
              const parsed = JSON.parse(reasoningAttachment);
              baseMessage.reasoning = parsed.content;
            }
          } catch (error) {
            console.warn("Failed to parse reasoning from attachments:", error);
          }
        }

        return baseMessage;
      }) || [],
    [loaderData.thread?.Message]
  );

  const {
    handleSubmit,
    messages,
    input,
    handleInputChange,
    setInput,
    append,
    status,
    stop,
    setMessages,
  } = useChat({
    api: "/api/chat",
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      model,
      threadId: loaderData.thread?.id,
    },

    initialMessages: initialMessages,
  });

  // Handle initial prompt auto-submit
  useEffect(() => {
    const navigationState = location.state as any;

    if (
      loaderData.isInitial &&
      navigationState?.shouldAutoSubmit &&
      navigationState?.prompt &&
      !hasProcessedInitial.current
    ) {
      hasProcessedInitial.current = true;

      // Set model from navigation state
      if (navigationState.model) {
        setModel(navigationState.model);
      }

      // Auto-submit the initial prompt immediately
      setInput(navigationState.prompt);

      // Submit immediately without setTimeout delay
      append({
        role: "user",
        content: navigationState.prompt,
      });

      // Clear the input after submission
      setInput("");
    }
  }, [loaderData.isInitial, location.state, append, setInput]);

  // Update model state when it changes (fixed infinite re-render)
  useEffect(() => {
    const newModel = loaderData.lastModel || "openai/gpt-oss-120b";
    if (model !== newModel) {
      setModel(newModel);
    }
  }, [loaderData.lastModel]); // ✅ CRITICAL FIX: Removed 'model' from dependencies

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        return;
      } else {
        e.preventDefault();
        handleSubmit();
        setInput("");
      }
    }
  };

  return (
    <div className="w-full 2xl:max-w-4xl lg:max-w-3xl mx-auto flex flex-col h-full px-5 md:px-0">
      <div className="flex flex-col gap-8 items-center justify-center p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col items-center gap-2 w-full`}
          >
            <div
              className={`${message.role === "user" ? "justify-end p-2 max-w-[70%] w-fit ml-auto rounded-xl rounded-br-none bg-accent" : "justify-start w-full"} flex`}
            >
              {message.role === "assistant" ? (
                <div className="w-full space-y-3">
                  {/* Show reasoning if available */}
                  {(message as any).reasoning && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        🧠 Reasoning
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {(message as any).reasoning}
                      </div>
                    </div>
                  )}
                  <MarkdownRenderer
                    content={message.content}
                    className="w-full prose prose-sm dark:prose-invert max-w-none"
                  />
                </div>
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
        {status === "submitted" && (
          <div className="flex justify-start w-full">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>
      <div className="sticky bottom-0 left-0 z-50 mt-auto border-t-8 border-l-8 border-r-8 border-muted rounded-t-xl w-full text-foreground">
        <form
          onSubmit={handleSubmit}
          className="border border-muted p-2 rounded-sm bg-background/80 backdrop-blur-sm flex flex-col gap-2"
        >
          <Textarea
            onKeyDown={handleKeyDown}
            value={input}
            onChange={handleInputChange}
            name="prompt"
            placeholder="Ask me anything..."
            className="text-lg border-none shadow-none resize-none focus:ring-0 focus-visible:ring-0"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Select name="model" value={model} onValueChange={setModel}>
                <SelectTrigger
                  size="sm"
                  className="text-sm font-medium border-none shadow-none hover:bg-accent"
                >
                  <SelectValue placeholder="Models" />
                </SelectTrigger>
                <SelectContent>
                  {loaderData.model.map((model) => (
                    <SelectItem key={model.code} value={model.code}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                  >
                    <Paperclip />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Attachments</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                  >
                    <Globe />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Web search</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              type={
                status === "submitted" || status === "streaming"
                  ? "button"
                  : "submit"
              }
              size="icon"
              onClick={() => {
                if (status === "submitted" || status === "streaming") {
                  // Stop the streaming
                  stop();

                  // Find the last assistant message and append "(Stopped by User)"
                  const lastMessageIndex = messages.length - 1;
                  const lastMessage = messages[lastMessageIndex];

                  if (lastMessage && lastMessage.role === "assistant") {
                    // Update the message in the UI immediately
                    const updatedMessages = [...messages];
                    updatedMessages[lastMessageIndex] = {
                      ...lastMessage,
                      content: lastMessage.content + "\n\n(Stopped by User)",
                    };

                    // Update the messages state
                    setMessages(updatedMessages);

                    // Save the partial data to the database
                    fetch("/api/chat", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        threadId: loaderData.thread.id,
                        partialContent:
                          lastMessage.content + "\n\n(Stopped by User)",
                        model: model,
                        isPartial: true,
                      }),
                    }).catch((error) => {
                      console.error("Error saving partial data:", error);
                    });
                  }
                }
              }}
            >
              {status === "submitted" || status === "streaming" ? (
                <Square />
              ) : (
                <Send />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
