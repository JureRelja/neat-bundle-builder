import {
  Card,
  Button,
  BlockStack,
  InlineStack,
  Divider,
  SkeletonPage,
  Page,
  Badge,
  Text,
  Layout,
  Icon,
} from "@shopify/polaris";
import { ArrowLeftIcon, ArrowRightIcon } from "@shopify/polaris-icons";
import { GapBetweenSections } from "../../constants";
import { StepType } from "@prisma/client";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  useNavigation,
  useSubmit,
  useLoaderData,
  useNavigate,
  Outlet,
  useParams,
  useRevalidator,
} from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { JsonData } from "../../types/jsonData";
import { bundleStepBasic, BundleStepBasicResources } from "~/types/BundleStep";
import { useEffect, useRef, useState } from "react";
import styles from "./route.module.css";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  let bundleStep: BundleStepBasicResources | null;

  if (!params.stepnum) {
    bundleStep = await db.bundleStep.findFirst({
      where: {
        bundleId: Number(params.bundleid),
        stepNumber: Number(1),
      },
      select: bundleStepBasic,
    });
  } else {
    bundleStep = await db.bundleStep.findFirst({
      where: {
        bundleId: Number(params.bundleid),
        stepNumber: Number(params.stepnum),
      },
      select: bundleStepBasic,
    });
  }

  if (!bundleStep) {
    throw new Response(null, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return json(
    new JsonData(
      true,
      "success",
      "Bundle step succesfuly retrieved",
      "",
      bundleStep,
    ),
    { status: 200 },
  );
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const action = formData.get("action") as string;

  switch (action) {
    //Adding a new step to the bundle
    case "addStep": {
      try {
        console.log("Adding a new step to the bundle");
      } catch (error) {
        console.log(error);
        return json(
          {
            ...new JsonData(
              false,
              "error",
              "There was an error with your request",
              "New step couldn't be created",
            ),
          },
          { status: 400 },
        );
      }

      return json(
        { ...new JsonData(true, "success", "New step was succesfully added.") },
        { status: 200 },
      );
    }

    default:
      return json(
        {
          ...new JsonData(
            true,
            "success",
            "This is the default action that doesn't do anything",
          ),
        },
        { status: 200 },
      );
  }
};

export default function Index({}) {
  const submit = useSubmit();
  const navigate = useNavigate();
  const nav = useNavigation();
  const shopify = useAppBridge();
  const isLoading = nav.state != "idle";
  const params = useParams();
  const revalidator = useRevalidator();

  const stepData: BundleStepBasicResources =
    useLoaderData<typeof loader>().data;

  //Sticky preview box logic
  const [sticky, setSticky] = useState({ isSticky: false, offset: 0 });
  const previewBoxRef = useRef<HTMLDivElement>(null);

  // handle scroll event
  const handleScroll = (elTopOffset: number, elHeight: number) => {
    if (window.scrollY > elTopOffset + 30) {
      setSticky({ isSticky: true, offset: elHeight });
    } else {
      setSticky({ isSticky: false, offset: 0 });
    }
  };

  // add/remove scroll event listener
  useEffect(() => {
    let previewBox = previewBoxRef.current?.getBoundingClientRect();
    const handleScrollEvent = () => {
      handleScroll(previewBox?.top || 0, previewBox?.height || 0);
    };

    window.addEventListener("scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("scroll", handleScrollEvent);
    };
  }, []);

  return (
    <>
      {isLoading ? (
        <SkeletonPage />
      ) : (
        <Page
          fullWidth
          titleMetadata={
            stepData.stepType === StepType.PRODUCT ? (
              <Badge tone="warning">Product step</Badge>
            ) : (
              <Badge>Content step</Badge>
            )
          }
          backAction={{
            content: "Products",
            onAction: async () => {
              // Save or discard the changes before leaving the page
              await shopify.saveBar.leaveConfirmation();
              navigate(`/app/bundles/${params.bundleid}`);
            },
          }}
          title={`Edit step - ${stepData.stepNumber}`}
        >
          <BlockStack gap={GapBetweenSections}>
            <Layout>
              <Layout.Section>
                <div
                  ref={previewBoxRef}
                  className={`${sticky.isSticky ? styles.sticky : ""}`}
                >
                  <BlockStack gap={GapBetweenSections}>
                    {/* <BundlePreview /> */}
                    <Card></Card>

                    {/* Navigation between steps */}
                    <InlineStack align="space-between">
                      <Button
                        icon={ArrowLeftIcon}
                        disabled={stepData.stepNumber === 1}
                        onClick={() => {
                          revalidator.revalidate();
                          navigate(
                            `/app/bundles/${params.bundleid}/steps/${stepData.stepNumber - 1}`,
                          );
                        }}
                      >
                        Step{" "}
                        {stepData.stepNumber !== 1
                          ? (stepData.stepNumber - 1).toString()
                          : "1"}
                      </Button>

                      <Button
                        icon={ArrowRightIcon}
                        disabled={stepData.stepNumber === 3}
                        onClick={() => {
                          revalidator.revalidate();
                          navigate(
                            `/app/bundles/${params.bundleid}/steps/${stepData.stepNumber + 1}`,
                          );
                        }}
                      >
                        Step{" "}
                        {stepData.stepNumber !== 3
                          ? (stepData.stepNumber + 1).toString()
                          : "3"}
                      </Button>
                    </InlineStack>
                    <Divider borderColor="transparent" />
                  </BlockStack>
                </div>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Outlet />
              </Layout.Section>
            </Layout>
            <Divider borderColor="transparent" />
          </BlockStack>
        </Page>
      )}
    </>
  );
}
