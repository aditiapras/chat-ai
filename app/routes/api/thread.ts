import { getAuth } from "@clerk/react-router/ssr.server";
import { prisma } from "~/lib/prisma";
import type { Route } from "./+types/thread";

export async function action(args: Route.ActionArgs) {
  const { request } = args;
  const { userId } = await getAuth(args);

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { prompt, model } = body;

  console.log("🔄 API Thread - Creating thread:", {
    userId,
    model,
    promptLength: prompt?.length,
  });

  if (!prompt || !model) {
    return new Response("Prompt and model are required", { status: 400 });
  }

  try {
    const thread = await prisma.thread.create({
      data: {
        userId: userId as string,
        model: model as string,
        title: prompt as string,
      },
    });

    console.log("✅ Thread created successfully:", {
      threadId: thread.id,
      title: thread.title.substring(0, 50) + "...",
    });

    return Response.json({
      success: true,
      threadId: thread.id,
      prompt,
      model,
    });
  } catch (error: any) {
    console.error("❌ Error creating thread:", error);
    return new Response("Error creating thread", { status: 500 });
  }
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("OK", { status: 200 });
}
