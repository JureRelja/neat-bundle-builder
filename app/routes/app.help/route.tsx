import { useNavigation, json, useLoaderData, Link, useNavigate } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Page, Card, BlockStack, SkeletonPage, Text, SkeletonBodyText, Divider, FooterHelp } from '@shopify/polaris';
import { authenticate } from '~/shopify.server';
import { JsonData } from '@adminBackend/service/dto/jsonData';
import { useAsyncSubmit } from '~/hooks/useAsyncSubmit';
import { useNavigateSubmit } from '~/hooks/useNavigateSubmit';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);

    return null;
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

    const loaderResponse = useLoaderData<typeof loader>();
    const navigate = useNavigate();

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
                <>
                    <Page
                        title="Bundles"
                        backAction={{
                            content: 'Back',
                            onAction: async () => {
                                navigate(-1);
                            },
                        }}>
                        <BlockStack gap="500">
                            <Divider borderColor="transparent" />
                        </BlockStack>

                        <FooterHelp>
                            View the <Link to="/app/featureRequest">help docs</Link>, <Link to="/app/featureRequest">suggest new features</Link>, or{' '}
                            <Link to="mailto:contact@neatmerchant.com" target="_blank">
                                contact us
                            </Link>{' '}
                            for support.
                        </FooterHelp>
                    </Page>
                </>
            )}
        </>
    );
}
