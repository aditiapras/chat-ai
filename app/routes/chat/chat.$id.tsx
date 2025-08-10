import { Textarea } from "~/components/ui/textarea";
import type { Route } from "./+types/chat.$id";
import { Button } from "~/components/ui/button";
import {
  Loader2,
  Paperclip,
  Send,
  Globe,
  Brain,
  ChevronDown,
  Square,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useEffect, useState } from "react";
import { prisma } from "~/lib/prisma";
import { useChat } from "@ai-sdk/react";
import { MarkdownRenderer } from "~/components/MarkdownRenderer";
import {
  Accordion,
  AccordionContent,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { AccordionItem } from "@radix-ui/react-accordion";

export async function loader(args: Route.LoaderArgs) {
  const { params } = args;

  const models = await prisma.aIModel.findMany({
    select: {
      code: true,
      name: true,
    },
  });

  const messages = await prisma.message.findMany({
    where: {
      threadId: params.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return { models, messages };
}

export default function ChatId({ loaderData, params }: Route.ComponentProps) {
  // Get model from last message or use default
  const getInitialModel = () => {
    if (loaderData.messages.length > 0) {
      const lastMessage = loaderData.messages[loaderData.messages.length - 1];
      return lastMessage.model;
    }
    return "openai/gpt-oss-120b";
  };

  const [model, setModel] = useState(getInitialModel());
  const [prompt, setPrompt] = useState("");

  // Transform database messages to useChat format
  const initialMessages = loaderData.messages.map((dbMessage) => ({
    id: dbMessage.id,
    role: dbMessage.role as "user" | "assistant",
    parts: [
      {
        type: "text" as const,
        text: dbMessage.content,
      },
    ],
  }));

  const { messages, sendMessage, status, setMessages, stop } = useChat();

  // Set initial messages from database on component mount and when thread changes
  useEffect(() => {
    setMessages(initialMessages);
    // Update model when thread changes
    setModel(getInitialModel());
  }, [params.id, setMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage({ text: prompt }, { body: { model, threadId: params.id } });

      setPrompt("");
    }
  };

  return (
    <div className="w-full 2xl:max-w-4xl lg:max-w-3xl mx-auto flex flex-col h-full px-5 md:px-0">
      <div className="flex flex-col gap-8 items-center justify-center p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className="flex flex-col items-center gap-2 w-full"
          >
            {message.parts.map((part, i) => {
              switch (part.type) {
                case "text":
                  return (
                    <div className="w-full" key={`${message.id}-${i}`}>
                      <div
                        className={`${message.role === "user" ? "justify-end p-2 max-w-[70%] w-fit ml-auto rounded-xl rounded-br-none bg-accent" : "justify-start w-full"} flex`}
                      >
                        {message.role === "assistant" ? (
                          <MarkdownRenderer
                            content={part.text}
                            className="w-full prose prose-sm max-w-none"
                          />
                        ) : (
                          part.text
                        )}
                      </div>
                    </div>
                  );
                case "reasoning":
                  return (
                    <div
                      key={`${message.id}-${i}`}
                      className="italic text-sm justify-start w-full"
                    >
                      <Accordion type="single" collapsible>
                        <AccordionItem value="reasoning" className="w-fit">
                          <AccordionTrigger className="flex items-center gap-2 w-fit">
                            <Brain className="w-4 h-4" />
                            <span>Reasoning</span>
                          </AccordionTrigger>
                          <AccordionContent className="w-fit">
                            {part.text}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  );
              }
            })}
          </div>
        ))}
        {status === "submitted" && (
          <div className="flex items-center justify-start w-full">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" />
              <span className="text-sm text-muted-foreground">
                AI is thinking...
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 left-0 z-50 mt-auto border-t-8 border-l-8 border-r-8 border-muted rounded-t-xl w-full text-foreground">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(
              { text: prompt },
              { body: { model, threadId: params.id } }
            );
            setPrompt("");
          }}
          className="border border-muted p-2 rounded-sm bg-background/80 backdrop-blur-sm flex flex-col gap-2"
        >
          <Textarea
            onKeyDown={handleKeyDown}
            value={prompt}
            onChange={(e) => setPrompt(e.currentTarget.value)}
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
                  {loaderData.models.map((model) => (
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
              onClick={() => {
                if (status === "streaming" || status === "submitted") {
                  stop();
                }
              }}
              size="icon"
            >
              {status === "streaming" || status === "submitted" ? (
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
