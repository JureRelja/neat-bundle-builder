import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { redisClient } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "CARTS_CREATE":
      console.log();

      break;

    case "APP_UNINSTALLED":
      if (session) {
        const offlineStoreId = `shopify_sessions_${session.id}`;
        const onlineStoreId = `shopify_sessions_${shop}`;

        await redisClient.del(offlineStoreId);
        await redisClient.del(onlineStoreId);
      }

      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
