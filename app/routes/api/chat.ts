import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Route } from "./+types/chat";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "~/lib/prisma";

export async function loader(args: Route.LoaderArgs) {
  return {
    success: true,
    status: 200,
  };
}

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const {
    messages,
    model,
    threadId,
  }: { messages: UIMessage[]; model: string; threadId: string } =
    await request.json();

  // Get the last message (user's new message)
  const lastMessage = messages[messages.length - 1];

  // Save user message to database
  if (lastMessage && lastMessage.role === "user") {
    const userMessageContent = lastMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");

    await prisma.message.create({
      data: {
        content: userMessageContent,
        role: "user",
        model: model,
        threadId: threadId,
      },
    });

    // Update thread timestamp
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
  }

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const result = streamText({
    model: openrouter.chat(model),
    messages: convertToModelMessages(messages),
    abortSignal: args.request.signal,
    onAbort: ({ steps }) => {
      console.log("Aborted at steps:", steps);
    },
    onFinish: async (result) => {
      // Save assistant response to database
      await prisma.message.create({
        data: {
          content: result.text,
          role: "assistant",
          model: model,
          threadId: threadId,
        },
      });

      // Update thread timestamp again
      await prisma.thread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
