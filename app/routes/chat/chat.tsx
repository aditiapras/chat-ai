import { Form, redirect } from "react-router";
import type { Route } from "./+types/chat";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Globe, Paperclip, Send } from "lucide-react";
import { getAuth } from "@clerk/react-router/ssr.server";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select";
import { prisma } from "~/lib/prisma";
import { useState } from "react";
import { useNavigate } from "react-router";

export const meta: Route.MetaFunction = () => {
  return [
    {
      title: "Chat",
      description: "Chat with AI",
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  const { sessionClaims } = await getAuth(args)

  const model = await prisma.aIModel.findMany({
    select: {
      name: true,
      code: true,
    }
  })
  return { sessionClaims, model }
}

export async function action(args: Route.ActionArgs) {
  const { request } = args
  const { userId } = await getAuth(args)

  const formData = await request.formData()
  const prompt = formData.get("prompt")
  const model = formData.get("model")

  const thread = await prisma.thread.create({
    data: {
      userId: userId as string,
      model: model as string,
      title: prompt as string,
    }
  })

  return { success: true, threadId: thread.id, prompt, model }
}

export default function Chat({ loaderData, actionData }: Route.ComponentProps) {
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("openai/gpt-oss-120b")
  const navigate = useNavigate()

  if (actionData?.success) {
    navigate(`/chat/${actionData?.threadId}`, { state: { prompt: actionData?.prompt, model: actionData?.model } })
  }


  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full 2xl:max-w-4xl xl:max-w-3xl lg:max-w-2xl md:max-w-xl mx-auto my-auto relative">
        <div className="flex flex-col gap-4 items-center justify-center">
          <div className="flex flex-col gap-2 w-full">
            <p className="text-2xl font-bold">Hi, {loaderData.sessionClaims?.firstName}!</p>
            <p className="text-muted-foreground">What do you want to know today?</p>
          </div>
          <div className="p-2 border border-muted rounded-xl w-full bg-muted/50 text-foreground">
            <Form method="post" className="border border-muted p-2 rounded-md bg-background flex flex-col gap-2">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} name="prompt" placeholder="Ask me anything..." className="text-lg border-none shadow-none resize-none focus:ring-0 focus-visible:ring-0" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Select name="model" required value={model} onValueChange={(value) => setModel(value)}>
                    <SelectTrigger size="sm" className="text-sm font-medium border-none shadow-none hover:bg-accent">
                      <SelectValue placeholder="Models" />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderData.model.map((model) => (
                        <SelectItem key={model.code} value={model.code}>{model.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="rounded-full"><Paperclip /></Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Attachments</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="rounded-full"><Globe /></Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Web search</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button disabled={!prompt} type="submit" size="icon"><Send /></Button>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
