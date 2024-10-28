import "@shopify/shopify-app-remix/adapters/node";
import { ApiVersion, AppDistribution, BillingInterval, BillingReplacementBehavior, DeliveryMethod, shopifyApp } from "@shopify/shopify-app-remix/server";
import { RedisSessionStorage } from "@shopify/shopify-app-session-storage-redis";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import { createClient } from "redis";
import { BillingPlanIdentifiers } from "./constants";
import { LoopsClient } from "loops";

const shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.October24,
    scopes: process.env.SCOPES?.split(","),
    appUrl: process.env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: new RedisSessionStorage(process.env.REDIS_URL || ""),
    distribution: AppDistribution.AppStore,
    restResources,
    billing: {
        //Basic billing plans
        [BillingPlanIdentifiers.BASIC_MONTHLY]: {
            replacementBehavior: BillingReplacementBehavior.ApplyOnNextBillingCycle,
            trialDays: 30,
            lineItems: [
                {
                    amount: 6.99,
                    currencyCode: "USD",
                    interval: BillingInterval.Every30Days,
                },
            ],
        },
        [BillingPlanIdentifiers.BASIC_YEARLY]: {
            replacementBehavior: BillingReplacementBehavior.ApplyOnNextBillingCycle,
            trialDays: 30,
            lineItems: [
                {
                    amount: 69.99,
                    currencyCode: "USD",
                    interval: BillingInterval.Annual,
                },
            ],
        },
        //Pro billing plans
        [BillingPlanIdentifiers.PRO_MONTHLY]: {
            replacementBehavior: BillingReplacementBehavior.ApplyOnNextBillingCycle,
            trialDays: 30,
            lineItems: [
                {
                    amount: 9.99,
                    currencyCode: "USD",
                    interval: BillingInterval.Every30Days,
                },
            ],
        },
        [BillingPlanIdentifiers.PRO_YEARLY]: {
            replacementBehavior: BillingReplacementBehavior.ApplyOnNextBillingCycle,
            trialDays: 30,
            lineItems: [
                {
                    amount: 99.99,
                    currencyCode: "USD",
                    interval: BillingInterval.Annual,
                },
            ],
        },
    },
    webhooks: {
        APP_UNINSTALLED: {
            deliveryMethod: DeliveryMethod.Http,
            callbackUrl: "/webhooks",
        },
    },
    hooks: {
        afterAuth: async ({ session }) => {
            shopify.registerWebhooks({ session });
        },
    },
    future: {
        unstable_newEmbeddedAuthStrategy: true,
    },
    ...(process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

//Additional setup

//Redis client for caching
let redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

redis.on("error", (error: String) => {
    console.error(`Redis client error:`, error);
});

//Loops.io client for sending emails
const loops = new LoopsClient(process.env.LOOPS_API_KEY as string);

//Exporting redis and loops clients
export const redisClient = redis;
export const loopsClient = loops;
