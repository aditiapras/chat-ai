import type { Route } from "./+types/chat";
import { getAuth } from "@clerk/react-router/ssr.server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText } from "ai";
import { prisma } from "~/lib/prisma";

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { messages, model, threadId, isPartial, partialContent } = body;

  console.log("🔄 API Chat - Received:", {
    messagesCount: messages?.length,
    model,
    threadId,
    isPartial,
    userId,
    lastMessageRole: messages?.[messages.length - 1]?.role,
    lastMessagePreview:
      messages?.[messages.length - 1]?.content?.substring(0, 50) + "...",
  });

  // Handle partial data saving
  if (isPartial && partialContent) {
    try {
      // Save partial content to database
      const aiMessage = await prisma.message.create({
        data: {
          threadId: threadId,
          role: "assistant",
          content: partialContent,
          model: model || "openai/gpt-4o-mini",
        },
      });

      console.log("✅ Partial AI response saved to database:", {
        messageId: aiMessage.id,
        threadId: aiMessage.threadId,
        role: aiMessage.role,
        contentLength: aiMessage.content.length,
      });

      return new Response(
        JSON.stringify({ success: true, messageId: aiMessage.id }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (dbError: any) {
      console.error("❌ Error saving partial AI response to DB:", {
        error: dbError.message,
        code: dbError.code,
        threadId,
        contentPreview: partialContent.substring(0, 50) + "...",
      });
      return new Response(
        JSON.stringify({ error: "Failed to save partial data" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

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
      // First, try to find an existing message with the same threadId, role, and approximate time
      const existingMessage = await prisma.message.findFirst({
        where: {
          threadId: threadId,
          role: "user",
          createdAt: {
            gte: new Date(Date.now() - 1000), // Within the last second
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // If found, update it; otherwise create a new one
      const userMessage = existingMessage
        ? await prisma.message.update({
            where: { id: existingMessage.id },
            data: {
              content: lastMessage.content,
              model: model || "openai/gpt-4o-mini",
            },
          })
        : await prisma.message.create({
            data: {
              threadId: threadId,
              role: "user",
              content: lastMessage.content,
              model: model || "openai/gpt-4o-mini",
            },
          });

      console.log("✅ User message saved to database:", {
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
        contentPreview: lastMessage.content.substring(0, 50) + "...",
      });
      return new Response(
        JSON.stringify({ error: "Failed to save user message" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
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
        // Create a new message for the AI response
        const aiMessage = await prisma.message.create({
          data: {
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

        // Check if we should generate a title for this thread
        // Only generate title after we have both user and assistant messages
        try {
          const messageCount = await prisma.message.count({
            where: { threadId: threadId },
          });

          // If this is the second message (first user message + first assistant response)
          // and the thread still has the default title, generate a new title
          if (messageCount === 2) {
            const thread = await prisma.thread.findUnique({
              where: { id: threadId },
            });

            // Only generate title if it's still the default
            if (thread && thread.title === "New Chat") {
              // Get both user and assistant messages
              const messages = await prisma.message.findMany({
                where: { threadId: threadId },
                orderBy: { createdAt: "asc" },
              });

              if (messages.length >= 2) {
                // Generate title based on initial conversation
                const userContent = messages[0].content;
                const assistantContent = messages[1].content;

                // Create a prompt for title generation
                const titlePrompt = `Generate a concise title (5-7 words) for a chat conversation based on these initial messages:
                User: ${userContent}
                Assistant: ${assistantContent}`;

                try {
                  // Use the same OpenRouter instance as used for streaming
                  const openrouter = createOpenRouter({
                    apiKey: process.env.OPENROUTER_API_KEY,
                  });

                  // Use AI SDK to generate title
                  const { text: generatedTitle } = await generateText({
                    model: openrouter.chat("openai/gpt-4o-mini"),
                    prompt: titlePrompt,
                    temperature: 0.7,
                    maxTokens: 15,
                  });

                  // Ensure title is not too long and remove quotes
                  let finalTitle =
                    generatedTitle.length > 50
                      ? generatedTitle.substring(0, 50).trim() + "..."
                      : generatedTitle;

                  // Remove leading and trailing quotes if present
                  finalTitle = finalTitle.trim();
                  if (
                    finalTitle.startsWith('"') &&
                    finalTitle.endsWith('"') &&
                    finalTitle.length > 1
                  ) {
                    finalTitle = finalTitle.substring(1, finalTitle.length - 1);
                  }
                  if (
                    finalTitle.startsWith("'") &&
                    finalTitle.endsWith("'") &&
                    finalTitle.length > 1
                  ) {
                    finalTitle = finalTitle.substring(1, finalTitle.length - 1);
                  }

                  // Update thread title
                  await prisma.thread.update({
                    where: { id: threadId },
                    data: { title: finalTitle.trim() || "Chat Conversation" },
                  });

                  console.log("✅ Thread title updated with AI:", {
                    threadId,
                    newTitle: finalTitle,
                  });
                } catch (aiError: any) {
                  console.error("❌ Error generating title with AI:", {
                    error: aiError.message,
                    threadId,
                  });

                  // Fallback to simple title generation
                  const combinedContent =
                    `${userContent} ${assistantContent}`.trim();
                  let fallbackTitle = "Chat Conversation";
                  if (combinedContent.length > 0) {
                    fallbackTitle =
                      combinedContent.length > 30
                        ? combinedContent.substring(0, 30).trim() + "..."
                        : combinedContent;
                  }

                  await prisma.thread.update({
                    where: { id: threadId },
                    data: { title: fallbackTitle },
                  });

                  console.log("✅ Thread title updated with fallback:", {
                    threadId,
                    newTitle: fallbackTitle,
                  });
                }
              }
            }
          }
        } catch (titleError: any) {
          console.error("❌ Error generating/updating thread title:", {
            error: titleError.message,
            threadId,
          });
        }
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
