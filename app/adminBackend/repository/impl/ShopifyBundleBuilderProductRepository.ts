import { AdminApiContext } from '@shopify/shopify-app-remix/server';
import { bundleTagIndentifier } from '../../../constants';
import { Product, ProductCreatePayload, ProductUpdatePayload } from '@shopifyGraphql/graphql';
import { ShopifyCatalogRepository } from './ShopifyCatalogRepository';

export class ShopifyBundleBuilderProductRepository {
    public static async createBundleProduct(admin: AdminApiContext, productTitle: string, storeUrl: string): Promise<string> {
        const response = await admin.graphql(
            `#graphql
              mutation createBundleBuilderProduct($productInput: ProductInput!) {
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
<p>Neat bundles app creates a dummy product for every bundle you configure in the app. These dummy products are used to make selling bundles easier for you and your customers.</p>`,
                    },
                },
            },
        );

        const data = await response.json();

        const product: ProductCreatePayload = data.data.productCreate;

        if ((product.userErrors && product.userErrors.length > 0) || !product.product || !product.product.id) {
            throw new Error('Failed to create the bundle product.');
        }

        const publishProductReponse = await ShopifyCatalogRepository.publishProductToOnlineStore(admin, product.product.id, storeUrl);

        if (!publishProductReponse) {
            throw new Error('Failed to publish the product to the online store');
        }

        return product.product?.id as string;
    }

    public async deleteBundleBuilderProduct(admin: AdminApiContext, bundleBuilderProductId: string): Promise<boolean> {
        const response = await admin.graphql(
            `#graphql
           mutation deleteProduct($productDeleteInput: ProductDeleteInput!) {
                productDelete(input: $productDeleteInput) {
                    deletedProductId
                }
            }`,
            {
                variables: {
                    productDeleteInput: {
                        id: bundleBuilderProductId,
                    },
                },
            },
        );

        const data = await response.json();

        const deletedProduct = data.data.productDelete;

        if ((deletedProduct.userErrors && deletedProduct.userErrors.length > 0) || !deletedProduct.deletedProductId) {
            return false;
        }

        return true;
    }

    public async updateBundleProductTitle(admin: AdminApiContext, bundleProductId: string, newBundleProductTitle: string): Promise<boolean> {
        const response = await admin.graphql(
            `#graphql
          mutation updateProductTitle($productInput: ProductInput!) {
            productUpdate(input: $productInput) {
              product{
                id
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
                        id: bundleProductId,
                        title: newBundleProductTitle,
                    },
                },
            },
        );

        const data = await response.json();

        const product: ProductUpdatePayload = data.data.productUpdate;

        if ((product.userErrors && product.userErrors.length > 0) || !product.product || !product.product.id) {
            return false;
        }

        return true;
    }

    public static async checkIfProductExists(admin: AdminApiContext, shopifyProductId: string): Promise<boolean> {
        const doesBundleBuilderProductExistResponse = await admin.graphql(
            `#graphql
        query getBundleBuilderProduct($id: ID!) {
            product(id: $id) {
                id
            }
        }`,
            {
                variables: {
                    id: shopifyProductId,
                },
            },
        );

        const doesBundleBuilderProductExistData = await doesBundleBuilderProductExistResponse.json();

        const doesBundleBuilderProductExist = doesBundleBuilderProductExistData.data.product !== null;

        if (doesBundleBuilderProductExist) {
            return true;
        }

        return false;
    }

    public static async getNumberOfProductVariants(admin: AdminApiContext, shopifyProductId: string): Promise<number> {
        const response = await admin.graphql(
            `#graphql
        query getProductVariants($id: ID!) {
            product(id: $id) {
                variants(first: 100) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        }`,
            {
                variables: {
                    id: shopifyProductId,
                },
            },
        );

        const data = await response.json();

        const variants = data.data.product.variants.edges;

        return variants.length;
    }
}

const shopifyBundleBuilderProductRepository = new ShopifyBundleBuilderProductRepository();

export default shopifyBundleBuilderProductRepository;
