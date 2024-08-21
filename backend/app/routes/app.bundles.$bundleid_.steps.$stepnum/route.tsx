import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  useNavigation,
  useLoaderData,
  useParams,
} from "@remix-run/react";
import { useAsyncSubmit } from "~/hooks/useAsyncSubmit";
import { useNavigateSubmit } from "~/hooks/useNavigateSubmit";
import {
  Card,
  Button,
  BlockStack,
  TextField,
  Text,
  Box,
  SkeletonPage,
  PageActions,
  SkeletonBodyText,
  SkeletonDisplayText,
  InlineGrid,
  ButtonGroup,
  ChoiceList,
  Divider,
} from "@shopify/polaris";

import { authenticate } from "../../shopify.server";
import { useState } from "react";
import {
  GapBetweenSections,
  GapBetweenTitleAndContent,
  GapInsideSection,
  HorizontalGap,
} from "../../constants";
import db from "../../db.server";
import {
  ProductResourceType,
  StepType,
  ContentInput,
  BundleStep,
} from "@prisma/client";
import { BundleStepAllResources, bundleStepFull } from "~/types/BundleStep";
import { JsonData } from "../../types/jsonData";
import ContentStepInputs from "./content-step-inputs";
import ResourcePicker from "./resource-picker";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const stepData: BundleStepAllResources | null = await db.bundleStep.findFirst(
    {
      where: {
        bundleId: Number(params.bundleid),
        stepNumber: Number(params.stepnum),
      },
      include: bundleStepFull,
    },
  );

  if (!stepData) {
    throw new Response(null, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return json({
    ...new JsonData(true, "success", "Step data was loaded", [], stepData),
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const action = formData.get("action") as string;

  switch (action) {
    //Deleting the step from the bundle
    case "deleteStep": {
      try {
        await db.$transaction([
          db.bundleStep.deleteMany({
            where: {
              bundleId: Number(params.bundleid),
              stepNumber: Number(params.stepnum),
            },
          }),
          db.bundleStep.updateMany({
            where: {
              bundleId: Number(params.bundleid),
              stepNumber: {
                gt: Number(params.stepnum),
              },
            },
            data: {
              stepNumber: {
                decrement: 1,
              },
            },
          }),
        ]);
      } catch (error) {
        return json(
          {
            ...new JsonData(
              false,
              "error",
              "There was an error with trying to delete the step",
            ),
          },
          { status: 400 },
        );
      }

      const url = new URL(request.url);

      if (
        url.searchParams.has("redirect") &&
        url.searchParams.get("redirect") === "true"
      ) {
        return redirect(`/app/bundles/${params.bundleid}`);
      }

      return json({
        ...new JsonData(true, "success", "Step was deleted"),
      });
    }

    //Duplicating the step
    case "duplicateStep": {
      const numOfSteps = await db.bundleStep.aggregate({
        _max: {
          stepNumber: true,
        },
        where: {
          bundleId: Number(params.bundleid),
        },
      });

      if (numOfSteps._max.stepNumber === 5)
        return json(
          {
            ...new JsonData(
              false,
              "error",
              "There was an error with your request",
              [
                {
                  fieldId: "stepsLength",
                  field: "Steps Length",
                  message: "You can't have more than 5 steps in a bundle.",
                },
              ],
            ),
          },
          { status: 400 },
        );

      try {
        let stepToDuplicate: BundleStepAllResources | null =
          await db.bundleStep.findFirst({
            where: {
              bundleId: Number(params.bundleid),
              stepNumber: Number(params.stepnum),
            },
            include: bundleStepFull,
          });

        if (!stepToDuplicate) {
          return json(
            {
              ...new JsonData(
                false,
                "error",
                "Thre was an error with your request",
                [
                  {
                    fieldId: "stepId",
                    field: "Step Id",
                    message:
                      "Bundle step with the entered 'stepId' doesn't exist.",
                  },
                ],
              ),
            },
            { status: 400 },
          );
        }

        //Creating a new step with the same data as the duplicated step
        if (stepToDuplicate.stepType === StepType.PRODUCT) {
          //Incrementing the step number for all steps with stepNumber greater than the duplicated step and then creating a new step with the same data as the duplicated step
          await db.$transaction([
            //Incrementing the step number for all steps with stepNumber greater than the duplicated step
            db.bundleStep.updateMany({
              where: {
                bundleId: Number(params.bundleid),
                stepNumber: {
                  gt: Number(params.stepnum),
                },
              },
              data: {
                stepNumber: {
                  increment: 1,
                },
              },
            }),
            db.bundleStep.create({
              data: {
                bundleId: Number(params.bundleid),
                stepNumber: stepToDuplicate.stepNumber + 1,
                title: `${stepToDuplicate.title} - Copy`,
                description: stepToDuplicate.description,
                stepType: stepToDuplicate.stepType,
                contentInputs: {
                  createMany: {
                    data: [{}, {}],
                  },
                },
                productsData: {
                  create: {
                    resourceType: stepToDuplicate.productsData?.resourceType,
                    productResources:
                      stepToDuplicate.productsData?.productResources,
                    minProductsOnStep:
                      stepToDuplicate.productsData?.minProductsOnStep,
                    maxProductsOnStep:
                      stepToDuplicate.productsData?.maxProductsOnStep,
                    allowProductDuplicates:
                      stepToDuplicate.productsData?.allowProductDuplicates,
                    showProductPrice:
                      stepToDuplicate.productsData?.showProductPrice,
                  },
                },
              },
            }),
          ]);
        } else if (stepToDuplicate.stepType === StepType.CONTENT) {
          //Incrementing the step number for all steps with stepNumber greater than the duplicated step and then creating a new step with the same data as the duplicated step
          await db.$transaction([
            db.bundleStep.updateMany({
              where: {
                bundleId: Number(params.bundleid),
                stepNumber: {
                  gt: Number(params.stepnum),
                },
              },
              data: {
                stepNumber: {
                  increment: 1,
                },
              },
            }),
            db.bundleStep.create({
              data: {
                bundleId: Number(params.bundleid),
                stepNumber: stepToDuplicate.stepNumber + 1,
                title: `${stepToDuplicate.title} - Copy`,
                description: stepToDuplicate.description,
                stepType: stepToDuplicate.stepType,
                productsData: {
                  create: {},
                },
                contentInputs: {
                  createMany: {
                    data: stepToDuplicate.contentInputs.map(
                      (contentStep: ContentInput) => {
                        return {
                          inputType: contentStep.inputType,
                          inputLabel: contentStep.inputLabel,
                          maxChars: contentStep.maxChars,
                          required: contentStep.required,
                        };
                      },
                    ),
                  },
                },
              },
            }),
          ]);
        }

        return json({
          ...new JsonData(true, "success", "Step was duplicated"),
        });
        // return redirect(`/app/bundles/${params.bundleid}/`);
      } catch (error) {
        console.log(error);
        return json(
          {
            ...new JsonData(false, "error", "Error while duplicating a step"),
          },
          { status: 400 },
        );
      }
    }

    //Updating the step
    case "updateStep": {
      const stepData: BundleStepAllResources = JSON.parse(
        formData.get("stepData") as string,
      );

      try {
        //Adding the products data to the step
        if (stepData.stepType === StepType.PRODUCT) {
          await db.bundleStep.update({
            where: {
              id: stepData.id,
            },
            data: {
              title: stepData.title,
              description: stepData.description,
              stepType: stepData.stepType,
              productsData: {
                update: {
                  resourceType: stepData.productsData?.resourceType,
                  productResources: stepData.productsData?.productResources,
                  minProductsOnStep: stepData.productsData?.minProductsOnStep,
                  maxProductsOnStep: stepData.productsData?.maxProductsOnStep,
                  allowProductDuplicates:
                    stepData.productsData?.allowProductDuplicates,
                  showProductPrice: stepData.productsData?.showProductPrice,
                },
              },
            },
          });
          //Adding the content inputs to the step
        } else if (stepData.stepType === StepType.CONTENT) {
          await db.bundleStep.update({
            where: {
              id: stepData.id,
            },
            data: {
              title: stepData.title,
              description: stepData.description,
              stepType: stepData.stepType,
              contentInputs: {
                updateMany: stepData.contentInputs.map(
                  (input: ContentInput) => {
                    return {
                      where: {
                        id: input.id,
                      },
                      data: {
                        inputType: input.inputType,
                        inputLabel: input.inputLabel,
                        maxChars: input.maxChars,
                        required: input.required,
                      },
                    };
                  },
                ),
              },
            },
          });
        }
      } catch (error) {
        console.log(error);
        return json(
          {
            ...new JsonData(
              false,
              "error",
              "There was an error with your request",
            ),
          },
          { status: 400 },
        );
      }
      return redirect(`/app/bundles/${params.bundleid}`);
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

export default function Index() {
  const nav = useNavigation();
  const isLoading = nav.state != "idle";
  const asyncSubmit = useAsyncSubmit();
  const navigateSubmit = useNavigateSubmit();
  const params = useParams();

  const serverStepData: BundleStepAllResources =
    useLoaderData<typeof loader>().data;

  const [stepData, setStepData] =
    useState<BundleStepAllResources>(serverStepData);

  const updateSelectedResources = (selectedResources: string[]) => {
    setStepData((stepData: BundleStepAllResources) => {
      if (!stepData.productsData) return stepData;

      return {
        ...stepData,
        productsData: {
          ...stepData.productsData,
          productResources: selectedResources,
        },
      };
    });
  };

  const updateContentInput = (contentInput: ContentInput) => {
    setStepData((stepData: BundleStepAllResources) => {
      return {
        ...stepData,
        contentInputs: stepData.contentInputs.map((input: ContentInput) => {
          if (input.id === contentInput.id) {
            return contentInput;
          }
          return input;
        }),
      };
    });
  };

  return (
    <>
      {isLoading ? (
        <SkeletonPage primaryAction fullWidth></SkeletonPage>
      ) : (
        <Form method="POST" data-discard-confirmation data-save-bar>
          <input type="hidden" name="action" value="updateStep" />
          <input
            type="hidden"
            name="stepData"
            value={JSON.stringify(stepData)}
          />
          <BlockStack gap={GapBetweenSections}>
            <Card>
              <BlockStack gap={GapBetweenTitleAndContent}>
                <Text as="h2" variant="headingMd">
                  Step settings
                </Text>
                <BlockStack gap={GapBetweenSections}>
                  <BlockStack gap={GapInsideSection}>
                    <TextField
                      label="Step title"
                      value={stepData.title}
                      onChange={(newTitle: string) => {
                        setStepData((stepData: BundleStepAllResources) => {
                          return {
                            ...stepData,
                            title: newTitle,
                          };
                        });
                      }}
                      autoComplete="off"
                      name={`stepTitle`}
                    />
                    <TextField
                      label="Step description"
                      value={stepData.description}
                      name={`stepDescription`}
                      onChange={(newDesc: string) => {
                        setStepData((stepData: BundleStepAllResources) => {
                          return {
                            ...stepData,
                            description: newDesc,
                          };
                        });
                      }}
                      autoComplete="off"
                    />
                  </BlockStack>
                  <ChoiceList
                    title="Step type:"
                    name={`stepType`}
                    choices={[
                      {
                        label: "Product step",
                        value: StepType.PRODUCT,
                        helpText: `Customers can choose products on this step`,
                      },
                      {
                        label: "Content step",
                        value: StepType.CONTENT,
                        helpText: `Customer can add text or images on this step`,
                      },
                    ]}
                    selected={[stepData.stepType]}
                    onChange={(selected: string[]) => {
                      setStepData((stepData: BundleStepAllResources) => {
                        return {
                          ...stepData,
                          stepType: selected[0] as StepType,
                        };
                      });
                    }}
                  />

                  <Divider borderColor="border-inverse" />
                  {stepData.stepType === StepType.PRODUCT ? (
                    <>
                      <BlockStack gap={GapInsideSection}>
                        <ChoiceList
                          title="Display products:"
                          name={`productResourceType`}
                          choices={[
                            {
                              label: "Selected products",
                              value: ProductResourceType.PRODUCT,
                            },
                            {
                              label: "Selected collections",
                              value: ProductResourceType.COLLECTION,
                            },
                          ]}
                          selected={[
                            stepData.productsData?.resourceType as string,
                          ]}
                          onChange={(selected: string[]) => {
                            setStepData((stepData: BundleStepAllResources) => {
                              if (!stepData.productsData) return stepData;
                              return {
                                ...stepData,
                                productsData: {
                                  ...stepData.productsData,
                                  resourceType:
                                    selected[0] as ProductResourceType,
                                },
                              };
                            });
                          }}
                        />

                        <ResourcePicker
                          resourceType={
                            stepData.productsData
                              ?.resourceType as ProductResourceType
                          }
                          selectedResources={
                            stepData.productsData?.productResources as string[]
                          }
                          updateSelectedResources={updateSelectedResources}
                        />
                      </BlockStack>

                      <Divider />
                      <BlockStack gap={GapInsideSection}>
                        <Text as="p">Rules</Text>

                        <InlineGrid columns={2} gap={HorizontalGap}>
                          <TextField
                            label="Minimum products to select"
                            type="number"
                            autoComplete="off"
                            inputMode="numeric"
                            name={`minProductsToSelect`}
                            min={1}
                            value={stepData.productsData?.minProductsOnStep.toString()}
                            onChange={(value) => {
                              setStepData(
                                (stepData: BundleStepAllResources) => {
                                  if (!stepData.productsData) return stepData;
                                  return {
                                    ...stepData,
                                    productsData: {
                                      ...stepData.productsData,
                                      minProductsOnStep: Number(value),
                                    },
                                  };
                                },
                              );
                            }}
                          />

                          <TextField
                            label="Maximum products to select"
                            type="number"
                            autoComplete="off"
                            inputMode="numeric"
                            name={`maxProductsToSelect`}
                            min={1}
                            value={stepData.productsData?.maxProductsOnStep.toString()}
                            onChange={(value) => {
                              setStepData(
                                (stepData: BundleStepAllResources) => {
                                  if (!stepData.productsData) return stepData;
                                  return {
                                    ...stepData,
                                    productsData: {
                                      ...stepData.productsData,
                                      maxProductsOnStep: Number(value),
                                    },
                                  };
                                },
                              );
                            }}
                          />
                        </InlineGrid>
                        <ChoiceList
                          title="Display products"
                          allowMultiple
                          name={`displayProducts`}
                          choices={[
                            {
                              label:
                                "Allow customers to select one product more than once",
                              value: "allowProductDuplicates",
                            },
                            {
                              label: "Show price under each product",
                              value: "showProductPrice",
                            },
                          ]}
                          selected={[
                            stepData.productsData?.allowProductDuplicates
                              ? "allowProductDuplicates"
                              : "",
                            stepData.productsData?.showProductPrice
                              ? "showProductPrice"
                              : "",
                          ]}
                          onChange={(selectedValues: string[]) => {
                            setStepData((stepData: BundleStepAllResources) => {
                              if (!stepData.productsData) return stepData;
                              return {
                                ...stepData,
                                productsData: {
                                  ...stepData.productsData,
                                  allowProductDuplicates:
                                    selectedValues.includes(
                                      "allowProductDuplicates",
                                    ),
                                  showProductPrice:
                                    selectedValues.includes("showProductPrice"),
                                },
                              };
                            });
                          }}
                        />
                      </BlockStack>
                    </>
                  ) : (
                    <BlockStack gap={GapBetweenSections}>
                      {stepData.contentInputs.map((contentInput, index) => (
                        <ContentStepInputs
                          key={contentInput.id}
                          contentInput={contentInput}
                          inputId={index + 1}
                          updateContentInput={updateContentInput}
                          stepNumber={stepData.stepNumber}
                        />
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Save action */}
            <Box width="full">
              <BlockStack inlineAlign="end">
                <ButtonGroup>
                  <Button
                    variant="primary"
                    tone="critical"
                    onClick={async (): Promise<void> => {
                      await shopify.saveBar.leaveConfirmation();
                      navigateSubmit(
                        "deleteStep",
                        `/app/bundles/${params.bundleid}/steps/${params.stepnum}?redirect=true`,
                      );
                    }}
                  >
                    Delete
                  </Button>
                  <Button variant="primary" submit>
                    Save step
                  </Button>
                </ButtonGroup>
              </BlockStack>
            </Box>
          </BlockStack>
        </Form>
      )}
    </>
  );
}