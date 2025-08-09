import { getAuth } from "@clerk/react-router/ssr.server";
import { prisma } from "~/lib/prisma";
import type { Route } from "./+types/thread";
import { threadRequestSchema, sanitizeInput } from "~/lib/validation";
import { SecureLogger } from "~/lib/logger";
import { withRateLimit } from "~/lib/rate-limiter";

/**
 * Generate intelligent title from prompt without AI API call
 * Fast, deterministic, and performance-optimized
 */
function generateSmartTitle(prompt: string): string {
  if (!prompt || typeof prompt !== "string") {
    return "New Chat";
  }

  // Clean and normalize the prompt
  const cleanPrompt = prompt.trim();

  // Handle very short prompts
  if (cleanPrompt.length <= 3) {
    return "New Chat";
  }

  // Extract key information patterns
  const patterns = [
    // Questions
    {
      regex:
        /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did)\s+(.+)/i,
      format: (match: RegExpMatchArray) => match[2],
    },
    // Commands/requests
    {
      regex:
        /^(help|explain|tell|show|create|make|write|generate|build|design)\s+(.+)/i,
      format: (match: RegExpMatchArray) => `${match[1]} ${match[2]}`,
    },
    // "I want/need" statements
    {
      regex: /^(i\s+(?:want|need|would like)\s+(?:to\s+)?)(.*)/i,
      format: (match: RegExpMatchArray) => match[2],
    },
    // Direct topics
    { regex: /^(.+)/, format: (match: RegExpMatchArray) => match[1] },
  ];

  let title = cleanPrompt;

  // Apply pattern matching
  for (const pattern of patterns) {
    const match = cleanPrompt.match(pattern.regex);
    if (match) {
      title = pattern.format(match);
      break;
    }
  }

  // Clean up the title
  title = title
    .replace(/[^\w\s\-.,!?]/g, "") // Remove special chars except basic punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate if too long (optimal length: 30-50 chars)
  if (title.length > 50) {
    title = title.substring(0, 47).trim() + "...";
  }

  // Fallback for edge cases
  if (title.length < 3 || title === "...") {
    return "New Chat";
  }

  return title;
}

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const { userId } = await getAuth(args);

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Apply rate limiting
  return withRateLimit("thread", userId, async () => {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      SecureLogger.error("Invalid JSON in request body", error as Error, {
        userId,
      });
      return new Response("Invalid JSON", { status: 400 });
    }

    // Validate input
    let prompt, model;
    try {
      const validatedData = threadRequestSchema.parse(body);
      ({ prompt, model } = validatedData);
    } catch (error: any) {
      SecureLogger.warn("Thread API validation failed", {
        userId,
        error: error.message,
      });
      return new Response("Invalid request format", { status: 400 });
    }

    SecureLogger.info("Creating new thread", {
      userId: userId.substring(0, 8) + "...",
      model,
      promptLength: prompt?.length,
    });

    try {
      // Generate intelligent title immediately from prompt (no AI API call)
      const smartTitle = generateSmartTitle(prompt);

      const thread = await prisma.thread.create({
        data: {
          userId: userId as string,
          model: model as string,
          title: smartTitle, // Immediate intelligent title
        },
      });

      SecureLogger.success("Thread created with smart title", {
        threadId: thread.id,
        title: smartTitle,
      });

      return Response.json({
        success: true,
        threadId: thread.id,
        prompt: sanitizeInput(prompt),
        model,
      });
    } catch (error: any) {
      SecureLogger.error("Error creating thread", error, { userId });
      return new Response("Error creating thread", { status: 500 });
    }
  });
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("OK", { status: 200 });
}
