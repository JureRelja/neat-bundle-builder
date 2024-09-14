import { AdminApiContext } from '@shopify/shopify-app-remix/server';
import { bundleTagIndentifier } from '../../constants';
import { Product, ProductCreatePayload } from 'src/gql/graphql';

export class ShopifyBundleProductService {
    public static async createBundleProduct(admin: AdminApiContext, productTitle: string): Promise<string | null> {
        const response = await admin.graphql(
            `#graphql
              mutation productCreate($productInput: ProductInput!) {
                productCreate(input: $productInput) {
                  product {
                    id
                    handle
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
            {
                variables: {
                    productInput: {
                        title: productTitle,
                        productType: 'Neat Bundle',
                        vendor: 'Neat Bundles',
                        status: 'ACTIVE',
                        tags: [bundleTagIndentifier],
                        descriptionHtml: `<p>This is a dummy product generated by <b>Neat bundles</b> app and must not be deleted or altered.</p>
<p>Neat bundles creates a dummy product for every bundle you configure in the app. These dummy products are used to make selling bundles easier for you and your customers.</p>`,
                    },
                },
            },
        );

        const data = await response.json();

        const product: ProductCreatePayload = data.data.productCreate;

        if (product.userErrors && product.userErrors.length > 0) {
            return null;
        }

        return product.product?.id as string;
    }
}
