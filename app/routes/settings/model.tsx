
import { Link, useFetcher } from "react-router"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"
import { Checkbox } from "~/components/ui/checkbox"
import { ArrowLeft, Brain, Eye, Files, Gem, Pencil } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Textarea } from "~/components/ui/textarea"
import { prisma } from "~/lib/prisma"
import { redirect } from "react-router"
import type { Route } from "./+types/model"

export const meta: Route.MetaFunction = () => {
    return [
        {
            title: "AI Models",
            description: "Manage your AI models",
        },
    ];
};

export const action = async ({ request }: { request: Request }) => {
    const formData = await request.formData()
    const model = formData.get("model")
    const code = formData.get("code")
    const description = formData.get("description")
    const provider = formData.get("provider")
    const supportImage = formData.get("supportImage")
    const supportFile = formData.get("supportFile")
    const hasReasoning = formData.get("hasReasoning")
    const isPremium = formData.get("isPremium")

    console.log(model, code, description, provider, supportImage, supportFile, hasReasoning, isPremium)

    try {
        await prisma.aIModel.create({
            data: {
                name: model as string,
                code: code as string,
                description: description as string,
                provider: provider as string,
                supportImage: supportImage === "on" ? true : false,
                supportFile: supportFile === "on" ? true : false,
                hasReasoning: hasReasoning === "on" ? true : false,
                isPremium: isPremium === "on" ? true : false,
            },
        })
    } catch (error) {
        console.log(error)
        return redirect("/settings/model")
    }
}

export const loader = async () => {
    const models = await prisma.aIModel.findMany()
    return models
}

export default function Model({ loaderData }: Route.ComponentProps) {
    const fetcher = useFetcher()

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        fetcher.submit(data, { method: "post" })
    }

    const isLoading = fetcher.state === "submitting"

    return (
        <div className='w-full 2xl:max-w-4xl xl:max-w-3xl lg:max-w-2xl md:max-w-xl mx-auto'>
            <div className="flex items-center justify-between my-4">
                <div>
                    <p className="text-2xl font-bold text-foreground">AI Models</p>
                    <p className="text-muted-foreground">Manage your AI models</p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger><Button>Add Model</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Add New Model</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please fill in the form below to add a new model.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <fetcher.Form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="model">Model</Label>
                                <Input type="text" name="model" placeholder="Model" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Model Code</Label>
                                <Input type="text" name="code" placeholder="Model Code" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Model Description</Label>
                                <Textarea name="description" placeholder="Model Description" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider">Provider</Label>
                                <Input type="text" name="provider" placeholder="Provider" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox name="supportImage" id="supportImage" />
                                <Label htmlFor="supportImage">Support Image</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox name="supportFile" id="supportFile" />
                                <Label htmlFor="supportFile">Support File</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox name="hasReasoning" id="hasReasoning" />
                                <Label htmlFor="hasReasoning">Has Reasoning</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox name="isPremium" id="isPremium" />
                                <Label htmlFor="isPremium">Is Premium</Label>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction type="submit" disabled={isLoading}>{isLoading ? "Adding..." : "Add Model"}</AlertDialogAction>
                            </AlertDialogFooter>
                        </fetcher.Form>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <div className="flex flex-col gap-4">
                {loaderData.map((model) => (
                    <Card key={model.id}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle>{model.name}</CardTitle>
                                    {model.isPremium && <Gem className="size-4" />}
                                </div>
                                <Button variant="outline" size="icon"><Pencil /></Button>
                            </div>
                            <Tooltip>

                                <CardDescription className="text-sm mt-2 text-left line-clamp-2">{model.description}</CardDescription>


                            </Tooltip>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                {model.hasReasoning &&
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="rounded-full p-2 border bg-pink-200">
                                                <Brain className="size-4" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Has reasoning capabilities</p>
                                        </TooltipContent>
                                    </Tooltip>
                                }
                                {model.supportImage &&
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="rounded-full p-2 border bg-green-200">
                                                <Eye className="size-4" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Supports image</p>
                                        </TooltipContent>
                                    </Tooltip>
                                }
                                {model.supportFile &&
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="rounded-full p-2 border bg-blue-200">
                                                <Files className="size-4" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Supports file</p>
                                        </TooltipContent>
                                    </Tooltip>
                                }
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
