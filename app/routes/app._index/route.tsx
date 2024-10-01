import { useNavigation, json, useLoaderData, Link } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import {
    Page,
    Card,
    Button,
    BlockStack,
    EmptyState,
    Banner,
    Text,
    Box,
    MediaCard,
    VideoThumbnail,
    SkeletonPage,
    SkeletonBodyText,
    SkeletonDisplayText,
    DataTable,
    ButtonGroup,
    Badge,
    Spinner,
    Divider,
} from '@shopify/polaris';
import { PlusIcon, ExternalIcon, EditIcon, DeleteIcon, SettingsIcon } from '@shopify/polaris-icons';
import { authenticate } from '../../shopify.server';
import db from '../../db.server';
import { User } from '@prisma/client';
import { BundleAndStepsBasicServer, BundleAndStepsBasicClient, bundleAndSteps } from '../../types/Bundle';
import { JsonData } from '../../types/jsonData';
import { useAsyncSubmit } from '../../hooks/useAsyncSubmit';
import { useNavigateSubmit } from '~/hooks/useNavigateSubmit';
import styles from '../app.bundles.$bundleid/route.module.css';
import { ShopifyCatalogService } from '~/adminBackend/service/ShopifyCatalogService';
import { request } from 'http';
import { useState } from 'react';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);

    const user: User | null = await db.user.findUnique({
        where: {
            storeUrl: session.shop,
        },
    });

    if (!user) {
        const response = await admin.graphql(
            `#graphql
        query  {
          shop {
            name
            email
            primaryDomain {
              url
            }
          }
        }`,
        );

        const data = await response.json();

        const onlineStorePublicationId = await ShopifyCatalogService.getOnlineStorePublicationId(admin);

        if (!onlineStorePublicationId) {
            return json(
                {
                    ...new JsonData(false, 'error', 'Failed to get the publication id of the online store', [], []),
                },
                { status: 500 },
            );
        }

        await db.user.create({
            data: {
                ownerName: '',
                storeUrl: session.shop,
                email: data.data.shop.email,
                storeName: data.data.shop.name,
                primaryDomain: data.data.shop.primaryDomain.url,
                onlineStorePublicationId: onlineStorePublicationId,
            },
        });
    }

    const bundleBuilders: BundleAndStepsBasicServer[] = await db.bundleBuilder.findMany({
        where: {
            user: {
                storeUrl: session.shop,
            },
            deleted: false,
        },
        select: bundleAndSteps,
        orderBy: {
            createdAt: 'desc',
        },
    });

    return json(
        {
            ...new JsonData(true, 'success', 'Bundles were succesfully returned', [], bundleBuilders),
        },
        { status: 200 },
    );
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);

    const formData = await request.formData();
    const action = formData.get('action');

    switch (action) {
        case 'dismissHomePageBanner': {
            break;
        }
        default: {
            return json(
                {
                    ...new JsonData(true, 'success', "This is the default action that doesn't do anything."),
                },
                { status: 200 },
            );
        }
    }
};

export default function Index() {
    const nav = useNavigation();
    const isLoading = nav.state !== 'idle';
    const asyncSubmit = useAsyncSubmit(); //Function for doing the submit action where the only data is action and url
    const navigateSubmit = useNavigateSubmit(); //Function for doing the submit action as if form was submitted
    const tableLoading: boolean = asyncSubmit.state !== 'idle'; //Table loading state

    const loaderResponse: JsonData<BundleAndStepsBasicClient[]> = useLoaderData<typeof loader>();

    const bundles: BundleAndStepsBasicClient[] = loaderResponse.data;

    const createBundle = () => {
        navigateSubmit('createBundle', '/app/bundles');
    };

    //Client state
    const [showBanner, setShowBanner] = useState(true);
    const [showTutorial, setShowTutorial] = useState(true);

    return (
        <>
            {isLoading ? (
                <SkeletonPage primaryAction>
                    <BlockStack gap="500">
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                        <Card>
                            <SkeletonBodyText />
                        </Card>
                    </BlockStack>
                </SkeletonPage>
            ) : (
                <Page
                    title="Bundles"
                    primaryAction={
                        <Button icon={PlusIcon} variant="primary" onClick={createBundle}>
                            Create bundle
                        </Button>
                    }>
                    <BlockStack gap="500">
                        <div id={styles.tableWrapper}>
                            <div className={tableLoading ? styles.loadingTable : styles.hide}>
                                <Spinner accessibilityLabel="Spinner example" size="large" />
                            </div>
                            <Card>
                                {bundles.length > 0 ? (
                                    <DataTable
                                        columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                                        headings={['Bundle ID', 'Name', 'Steps', 'Status', 'Actions', 'Settings', 'Preview']}
                                        rows={bundles.map((bundle: BundleAndStepsBasicClient) => {
                                            return [
                                                <Text as="p" tone="base">
                                                    {bundle.id}
                                                </Text>,

                                                //
                                                <Link to={`/app/bundles/${bundle.id}`}>
                                                    <Text as="p" tone="base">
                                                        {bundle.title}
                                                    </Text>
                                                </Link>,
                                                //
                                                bundle.steps.length,
                                                //
                                                <Link to={`/app/bundles/${bundle.id}`}>
                                                    {bundle.published ? <Badge tone="success">Active</Badge> : <Badge tone="info">Draft</Badge>}
                                                </Link>,
                                                //
                                                <ButtonGroup>
                                                    <Button
                                                        icon={DeleteIcon}
                                                        variant="secondary"
                                                        tone="critical"
                                                        onClick={() => {
                                                            asyncSubmit.submit('deleteBundle', `/app/bundles/${bundle.id}`);
                                                        }}>
                                                        Delete
                                                    </Button>

                                                    {/* <Button
                          icon={PageAddIcon}
                          variant="secondary"
                          onClick={() => {
                            submitAction(
                              "duplicateBundle",
                              true,
                              `/app/bundles/${bundle.id}`,
                            );
                          }}
                        >
                          Duplicate
                        </Button> */}

                                                    <Button icon={EditIcon} variant="primary" url={`/app/bundles/${bundle.id}`}>
                                                        Edit
                                                    </Button>
                                                </ButtonGroup>,
                                                //
                                                <Button icon={SettingsIcon} variant="secondary" tone="success" url={`/app/bundles/${bundle.id}/settings/?redirect=/app`}>
                                                    Settings
                                                </Button>,
                                                <Button icon={ExternalIcon} variant="secondary" tone="success" url={`${bundle.bundlePageUrl}?preview=true`} target="_blank">
                                                    Preview
                                                </Button>,
                                            ];
                                        })}></DataTable>
                                ) : (
                                    <EmptyState
                                        heading="Let’s create the first custom bundle for your customers!"
                                        action={{
                                            content: 'Create bundle',
                                            icon: PlusIcon,
                                            onAction: createBundle,
                                        }}
                                        fullWidth
                                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
                                        <p>Your customers will be able to use the custom bundles you create to create and buy their own custom bundles.</p>
                                    </EmptyState>
                                )}
                            </Card>
                        </div>

                        {/* Video tutorial on how to use the app */}

                        {showTutorial && (
                            <MediaCard
                                title="Watch a short tutorial to get quickly started"
                                primaryAction={{
                                    content: 'Watch tutorial',
                                    onAction: () => {},
                                    icon: ExternalIcon,
                                    url: 'https://help.shopify.com',
                                    target: '_blank',
                                }}
                                size="small"
                                description="We recommend watching this short tutorial to get started with creating Neat Bundle Builder"
                                onDismiss={() => {
                                    setShowTutorial(false);
                                }}
                                popoverActions={[{ content: 'Dismiss', onAction: () => {} }]}>
                                <VideoThumbnail
                                    videoLength={80}
                                    thumbnailUrl="https://burst.shopifycdn.com/photos/business-woman-smiling-in-office.jpg?width=1850"
                                    onClick={() => console.log('clicked')}
                                />
                            </MediaCard>
                        )}

                        {/* Banner for encuraging users to rate the app */}

                        {showBanner && (
                            <Banner
                                title="Enjoying the app?"
                                onDismiss={() => {
                                    setShowBanner(false);
                                }}>
                                <BlockStack gap="200">
                                    <Box>
                                        <p>We'd highly appreciate getting a review!</p>
                                    </Box>

                                    <Box>
                                        <Button>⭐ Leave a review</Button>
                                    </Box>
                                </BlockStack>
                            </Banner>
                        )}
                        <Divider borderColor="transparent" />
                    </BlockStack>
                </Page>
            )}
        </>
    );
}