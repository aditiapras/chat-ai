import type { Route } from "./+types/chat";
import { getAuth } from "@clerk/react-router/ssr.server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText } from "ai";
import { prisma } from "~/lib/prisma";
import {
  chatRequestSchema,
  validateRequest,
  sanitizeInput,
} from "~/lib/validation";
import { SecureLogger } from "~/lib/logger";
import { withRateLimit } from "~/lib/rate-limiter";

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { messages, model, threadId, isPartial, partialContent } = body;

  // Handle partial data saving
  if (isPartial && partialContent) {
    const aiMessage = await prisma.message.create({
      data: {
        threadId: threadId,
        role: "assistant",
        content: partialContent,
        model: model || "openai/gpt-4o-mini",
      },
    });
    return Response.json({ success: true, messageId: aiMessage.id });
  }

  if (!messages || messages.length === 0) {
    return new Response("No messages provided", { status: 400 });
  }

  // Save user message quickly
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user" && lastMessage?.content?.trim()) {
    await prisma.message.create({
      data: {
        threadId: threadId,
        role: "user",
        content: lastMessage.content,
        model: model || "openai/gpt-4o-mini",
      },
    });
  }

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Check if model supports reasoning (simple check)
  const isReasoningModel =
    model?.includes("o1-") || model?.includes("reasoning");

  const result = streamText({
    model: openrouter.chat(model),
    messages: messages,
    // Enable reasoning for compatible models
    ...(isReasoningModel && {
      experimental_providerMetadata: {
        openrouter: {
          reasoning: true,
        },
      },
    }),
    onChunk: ({ chunk }) => {
      // Handle reasoning chunks as they stream
      if (chunk.type === "text-delta" && (chunk as any).reasoning) {
        // Reasoning is being streamed - this will be handled by the client
        console.log("Reasoning chunk:", (chunk as any).reasoning);
      }
    },
    onFinish: async (completion: any) => {
      // Save AI response to database with reasoning if available
      const messageData: any = {
        threadId: threadId,
        role: "assistant",
        content: completion.text,
        model: model || "openai/gpt-4o-mini",
      };

      // Store reasoning in attachments if available
      if (completion.reasoning) {
        messageData.attachments = [
          JSON.stringify({
            type: "reasoning",
            content: completion.reasoning,
          }),
        ];
      }

      await prisma.message.create({
        data: messageData,
      });
    },
  });

  return result.toDataStreamResponse();
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("OK", { status: 200 });
}
