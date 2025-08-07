import { verifyWebhook } from "@clerk/react-router/webhooks";
import type { Route } from "./+types/webhook";

export const action = async ({ request }: Route.ActionArgs) => {
    try {
      const evt = await verifyWebhook(request);
      const { id } = evt.data;
      const eventType = evt.type;
  
      return new Response("Webhook received", { status: 200 });
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new Response("Error verifying webhook", { status: 400 });
    }
  };

export async function loader() {
    return {
      success: true,
      status: 200,
    };
  }
  