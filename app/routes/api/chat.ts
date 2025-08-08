import type { Route } from "./+types/chat";
import { getAuth } from "@clerk/react-router/ssr.server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, convertToCoreMessages } from "ai";
import { prisma } from "~/lib/prisma";

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { messages, model, threadId } = body;

  console.log("🔄 API Chat - Received:", {
    messagesCount: messages?.length,
    model,
    threadId,
    userId,
    lastMessageRole: messages?.[messages.length - 1]?.role,
    lastMessagePreview:
      messages?.[messages.length - 1]?.content?.substring(0, 50) + "...",
  });

  if (!threadId) {
    return new Response("ThreadId is required", { status: 400 });
  }

  // Validate messages array
  if (!messages || messages.length === 0) {
    console.error("❌ No messages provided");
    return new Response("No messages provided", { status: 400 });
  }

  // Get the last user message to save to database
  const lastMessage = messages[messages.length - 1];
  console.log("🔍 Analyzing last message:", {
    role: lastMessage?.role,
    contentLength: lastMessage?.content?.length,
    messageId: lastMessage?.id,
  });

  if (
    lastMessage &&
    lastMessage.role === "user" &&
    lastMessage.content?.trim()
  ) {
    try {
      console.log("💾 Saving user message to DB:", {
        threadId,
        content:
          lastMessage.content.substring(0, 100) +
          (lastMessage.content.length > 100 ? "..." : ""),
        role: lastMessage.role,
        model,
      });

      // Use upsert to handle race conditions more gracefully
      const userMessage = await prisma.message.upsert({
        where: {
          unique_message: {
            threadId: threadId,
            content: lastMessage.content,
            role: "user",
          },
        },
        update: {
          // Update model if needed
          model: model || "openai/gpt-4o-mini",
        },
        create: {
          threadId: threadId,
          role: "user",
          content: lastMessage.content,
          model: model || "openai/gpt-4o-mini",
        },
      });

      console.log("✅ User message saved/updated successfully:", {
        messageId: userMessage.id,
        threadId: userMessage.threadId,
        role: userMessage.role,
        contentLength: userMessage.content.length,
      });
    } catch (dbError: any) {
      console.error("❌ Error saving user message to DB:", {
        error: dbError.message,
        code: dbError.code,
        threadId,
        content: lastMessage.content.substring(0, 50) + "...",
      });
      // Don't return error response, continue with AI generation
      // The message might already exist from a previous request
    }
  } else {
    console.log("⚠️ No valid user message found to save:", {
      lastMessageRole: lastMessage?.role,
      lastMessageContent: lastMessage?.content?.substring(0, 50) + "...",
      hasContent: !!lastMessage?.content?.trim(),
    });
  }

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  console.log("🚀 Starting AI text generation...");

  const result = streamText({
    model: openrouter.chat(model),
    messages: messages,
    onFinish: async (completion) => {
      // Save AI response to database after completion
      console.log("💾 onFinish callback called with completion:", {
        threadId,
        contentLength: completion.text.length,
        role: "assistant",
        model,
        preview:
          completion.text.substring(0, 100) +
          (completion.text.length > 100 ? "..." : ""),
      });

      try {
        // Use upsert to handle race conditions more gracefully
        const aiMessage = await prisma.message.upsert({
          where: {
            unique_message: {
              threadId: threadId,
              content: completion.text,
              role: "assistant",
            },
          },
          update: {
            // Update model if needed
            model: model || "openai/gpt-4o-mini",
          },
          create: {
            threadId: threadId,
            role: "assistant",
            content: completion.text,
            model: model || "openai/gpt-4o-mini",
          },
        });

        console.log("✅ AI response saved/updated successfully to database:", {
          messageId: aiMessage.id,
          threadId: aiMessage.threadId,
          role: aiMessage.role,
          contentLength: aiMessage.content.length,
        });
      } catch (dbError: any) {
        console.error("❌ Error saving AI response to DB:", {
          error: dbError.message,
          code: dbError.code,
          threadId,
          contentPreview: completion.text.substring(0, 50) + "...",
        });
      }
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
