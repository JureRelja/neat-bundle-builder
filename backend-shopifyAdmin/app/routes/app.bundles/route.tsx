import { redirect, json, Outlet } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { Bundle } from "@prisma/client";
import { JsonData } from "../../types/jsonData";
import { bundleTagIndentifier } from "~/constants";

export const loader = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  // const formData = await request.formData();
  // if (!formData) {
  //   return redirect("/app");
  // }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "createBundle": {
      const { _max }: { _max: { id: number | null } } =
        await db.bundle.aggregate({
          _max: {
            id: true,
          },
          where: {
            storeUrl: session.shop,
          },
        });

      //Create a new product that will be used as a bundle wrapper
      const response = await admin.graphql(
        `#graphql
        mutation productCreate($productInput: ProductInput!) {
          productCreate(input: $productInput) {
            product {
              id
            }
          }
        }`,
        {
          variables: {
            productInput: {
              title: `Neat Bundle ${_max.id ? _max.id : ""}`,
              productType: "Neat Bundle",
              vendor: "Neat Bundles",
              published: true,
              tags: [bundleTagIndentifier],
              descriptionHtml: `<p>This is a dummy product generated by <b>Neat bundles</b> app and must not be deleted or altered.</p>
<p>Neat bundles creates a dummy product for every bundle you configure in the app. These dummy products are used to make selling bundles easier for you and your customers.</p>`,
            },
          },
        },
      );

      const productData = await response.json();

      //Create a new page for displaying the new bundle
      const bundlePage = new admin.rest.resources.Page({
        session: session,
      });

      (bundlePage.title = `Neat Bundle ${_max.id ? _max.id : ""}`),
        (bundlePage.body_html = `<p>This is a page for displaying the bundle created by <b>Neat bundles</b> app</p>
          <p>Neat bundles creates a page for every bundle you configure in the app. These pages are used to display the bundle to your customers.</p>
          <p>You can customize this page by adding more content or changing the layout of the page.</p>
          `);

      const [saveBundlePageRes, bundle]: [void, Bundle] = await Promise.all([
        //Save the new bundle page
        await bundlePage.save({
          update: true,
        }),
        //Create a new bundle in the database
        await db.bundle.create({
          data: {
            user: {
              connect: {
                storeUrl: session.shop,
              },
            },
            title: `New bundle ${_max.id ? _max.id : ""}`,
            shopifyProductId: productData.data.productCreate.product.id,
            shopifyPageId: bundlePage.id?.toString() || "",
            bundleSettings: {
              create: {
                bundleColors: {
                  create: {},
                },
                bundleLabels: {
                  create: {},
                },
              },
            },
            steps: {
              create: [
                {
                  stepNumber: 1,
                  title: "Step 1",
                  stepType: "PRODUCT",
                  productsData: {
                    create: {},
                  },
                  contentInputs: {
                    create: [{}, {}],
                  },
                },
                {
                  stepNumber: 2,
                  title: "Step 2",
                  stepType: "PRODUCT",
                  productsData: {
                    create: {},
                  },
                  contentInputs: {
                    create: [{}, {}],
                  },
                },
                {
                  stepNumber: 3,
                  title: "Step 3",
                  stepType: "PRODUCT",
                  productsData: {
                    create: {},
                  },
                  contentInputs: {
                    create: [{}, {}],
                  },
                },
              ],
            },
          },
        }),
      ]);

      //Adding the bundleId metafield to the page for easier identification
      bundlePage.metafields = [
        {
          key: "bundle_id_page",
          value: bundle.id,
          type: "number_integer",
          namespace: "neat_bundles_app",
        },
      ];

      await bundlePage.save({
        update: true,
      });

      return redirect(`/app/bundles/${bundle.id}`);
    }

    default: {
      return json(
        {
          ...new JsonData(
            true,
            "success",
            "This is the default action that doesn't do anything.",
          ),
        },
        { status: 200 },
      );
    }
  }
};

export default function Index() {
  return <Outlet />;
}
