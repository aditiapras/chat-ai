import type { Route } from "./+types/chat";

export const meta: Route.MetaFunction = () => {
  return [
    {
      title: "Chat",
      description: "Chat with AI",
    },
  ];
};

export default function Chat() {
  return (
    <div className="w-full 2xl:max-w-4xl xl:max-w-3xl lg:max-w-2xl md:max-w-xl mx-auto">
      Chat
      <div className="aspect-square"></div>
    </div>
  );
}
