import { Textarea } from '~/components/ui/textarea'
import { Button } from '~/components/ui/button'
import { Globe, Paperclip, Send } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { useChat } from "@ai-sdk/react"
import { useState } from "react"
import type { Route } from "./+types/chat.$id"
import { Loader2 } from "lucide-react"
import { prisma } from '~/lib/prisma'
import { getAuth } from "@clerk/react-router/ssr.server"
import { useLocation } from 'react-router'


export const meta: Route.MetaFunction = ({ data }) => {
    return [
        {
            title: "Chat",
            description: "Chat with AI",
        },
    ];
};

export async function loader(args: Route.LoaderArgs) {

    const model = await prisma.aIModel.findMany({
        select: {
            name: true,
            code: true,
        }
    })
    return { model }
}

export default function ChatId({ loaderData }: Route.ComponentProps) {
    const [prompt, setPrompt] = useState("")
    const [model, setModel] = useState("openai/gpt-oss-120b")
    const { messages, sendMessage, status } = useChat()
    const location = useLocation()

    console.log(location.state)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter") {
            if (e.shiftKey) {
                return;
            } else {
                e.preventDefault()
                sendMessage({ text: prompt, files: [] }, { body: { model } })
                setPrompt('')
            }
        }
    }

    return (
        <div className="w-full 2xl:max-w-4xl lg:max-w-3xl mx-auto flex flex-col h-full px-5 md:px-0">
            <div className="flex flex-col gap-8 items-center justify-center p-4">
                {messages.map((message) => (
                    <div key={message.id} className={`flex flex-col items-center gap-2 w-full`}>
                        {message.parts.map((part, i) => {
                            switch (part.type) {
                                case 'text':
                                    return <div className={`${message.role === 'user' ? 'justify-end p-2 w-fit ml-auto rounded-xl rounded-br-none bg-accent' : 'justify-start w-full'} flex`} key={`${message.id}-${i}`}>{part.text}</div>;
                            }
                        })}
                    </div>
                ))}
                {status === 'submitted' && <div className="flex justify-start w-full"><Loader2 className="animate-spin" /></div>}
            </div>
            <div className="sticky bottom-0 left-0 z-50 mt-auto border-t-8 border-l-8 border-r-8 border-muted rounded-t-xl w-full text-foreground">
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    sendMessage({ text: prompt, files: [] }, { body: { model } })
                    setPrompt('')
                }} className="border border-muted p-2 rounded-sm bg-background/80 backdrop-blur-sm flex flex-col gap-2">
                    <Textarea onKeyDown={handleKeyDown} value={prompt} onChange={(e) => setPrompt(e.currentTarget.value)} name="prompt" placeholder="Ask me anything..." className="text-lg border-none shadow-none resize-none focus:ring-0 focus-visible:ring-0" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Select name="model" value={model} onValueChange={setModel}>
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
                        <Button type="submit" size="icon"><Send /></Button>
                    </div>
                </form>
            </div>
        </div>

    )
}
