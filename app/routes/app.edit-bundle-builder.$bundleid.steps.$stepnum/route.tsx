import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useNavigation, Outlet } from "@remix-run/react";
import { SkeletonPage } from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { StepType, BundleStep } from "@prisma/client";
import { error, JsonData } from "../../adminBackend/service/dto/jsonData";
import { ApiCacheService } from "~/adminBackend/service/utils/ApiCacheService";
import { ApiCacheKeyService } from "~/adminBackend/service/utils/ApiCacheKeyService";
import userRepository from "~/adminBackend/repository/impl/UserRepository";
import { bundleBuilderStepRepository } from "~/adminBackend/repository/impl/bundleBuilderStep/BundleBuilderStepRepository";
import { bundleBuilderProductStepService } from "~/adminBackend/service/impl/bundleBuilder/step/BundleBuilderProductStepService";
import { BundleStepContent, BundleStepProduct } from "~/adminBackend/service/dto/BundleStep";
import { bundleBuilderStepService } from "~/adminBackend/service/impl/bundleBuilder/step/BundleBuilderStepService";
import { bundleBuilderContentStepService } from "~/adminBackend/service/impl/bundleBuilder/step/BundleBuilderContentStepService";
import { bundleBuilderStepsService } from "~/adminBackend/service/impl/BundleBuilderStepsService";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    await authenticate.admin(request);

    const stepData: BundleStep | null = await bundleBuilderStepRepository.getStepByBundleIdAndStepNumber(Number(params.bundleid), Number(params.stepnum));

    if (!stepData) {
        throw new Response(null, {
            status: 404,
            statusText: "Not Found",
        });
    }

    if (stepData.stepType === "CONTENT") redirect("content");
    else if (stepData.stepType === "PRODUCT") redirect("product");

    return null;
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    const user = await userRepository.getUserByStoreUrl(session.shop);
    if (!user) return redirect("/app");

    const formData = await request.formData();
    const action = formData.get("action") as string;

    const bundleId = params.bundleid;
    const stepNum = params.stepnum;

    if (!bundleId || !stepNum) {
        return json(
            {
                ...new JsonData(false, "error", "There was an error with your request", [
                    {
                        fieldId: "bundleId",
                        field: "Bundle Id",
                        message: "Bundle Id is missing.",
                    },
                    {
                        fieldId: "stepNum",
                        field: "Step Number",
                        message: "Step Number is missing.",
                    },
                ]),
            },
            { status: 400 },
        );
    }

    switch (action) {
        //Deleting the step from the bundle
        case "deleteStep": {
            try {
                const bundleStep = await bundleBuilderStepRepository.getStepByBundleIdAndStepNumber(Number(params.bundleid), Number(params.stepnum));

                if (!bundleStep) {
                    throw new Error("Step not found");
                }

                await bundleBuilderStepRepository.deleteStepByBundleBuilderIdAndStepNumber(Number(params.stepnum), Number(params.bundleid));
            } catch (error) {
                return json(
                    {
                        ...new JsonData(false, "error", "There was an error with trying to delete the step"),
                    },
                    { status: 400 },
                );
            }

            const url = new URL(request.url);

            if (url.searchParams.has("redirect") && url.searchParams.get("redirect") === "true") {
                return redirect(`/app/edit-bundle-builder/${params.bundleid}`);
            }

            // Clear the cache for the bundle
            const cacheKeyService = new ApiCacheKeyService(session.shop);

            await Promise.all([
                ApiCacheService.multiKeyDelete(await cacheKeyService.getAllStepsKeys(params.bundleid as string)),
                ApiCacheService.singleKeyDelete(cacheKeyService.getBundleDataKey(params.bundleid as string)),
            ]);

            return json({
                ...new JsonData(true, "success", "Step was deleted"),
            });
        }

        //Duplicating the step
        case "duplicateStep": {
            const canAddMoreSteps = await bundleBuilderStepsService.canAddMoreSteps(Number(params.bundleid), user);

            if (!canAddMoreSteps.ok) {
                return json(canAddMoreSteps, { status: 400 });
            }

            try {
                let stepToDuplicate: BundleStep | null = await bundleBuilderStepRepository.getStepByBundleIdAndStepNumber(Number(params.bundleid), Number(params.stepnum));

                if (!stepToDuplicate) {
                    return json(
                        {
                            ...new JsonData(false, "error", "Thre was an error with your request", [
                                {
                                    fieldId: "stepId",
                                    field: "Step Id",
                                    message: "Bundle step with the entered 'stepId' doesn't exist.",
                                },
                            ]),
                        },
                        { status: 400 },
                    );
                }

                //Creating a new step with the same data as the duplicated step
                if (stepToDuplicate.stepType === StepType.PRODUCT) {
                    bundleBuilderProductStepService.duplicateStep(Number(bundleId), stepToDuplicate.id);
                } else if (stepToDuplicate.stepType === StepType.CONTENT) {
                    bundleBuilderContentStepService.duplicateStep(Number(bundleId), stepToDuplicate.id);
                }

                // Clear the cache for the bundle
                const cacheKeyService = new ApiCacheKeyService(session.shop);

                await Promise.all([
                    ApiCacheService.multiKeyDelete(await cacheKeyService.getAllStepsKeys(params.bundleid as string)),
                    ApiCacheService.singleKeyDelete(cacheKeyService.getBundleDataKey(params.bundleid as string)),
                ]);

                return json({
                    ...new JsonData(true, "success", "Step was duplicated"),
                });
                // return redirect(`/app/edit-bundle-builder/${params.bundleid}/`);
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
            const stepData: BundleStep | BundleStepProduct | BundleStepContent = JSON.parse(formData.get("stepData") as string);

            const errors: error[] = [];

            const basicErrors = bundleBuilderStepService.checkIfErrorsInStepData(stepData);
            errors.push(...basicErrors);

            if (stepData.stepType === StepType.PRODUCT) {
                const stepSpecificErrors = bundleBuilderProductStepService.checkIfErrorsInStepData(stepData as BundleStepProduct);
                errors.push(...stepSpecificErrors);
            } else if (stepData.stepType === StepType.CONTENT) {
                const stepSpecificErrors = bundleBuilderContentStepService.checkIfErrorsInStepData(stepData as BundleStepContent);
                errors.push(...stepSpecificErrors);
            }

            if (errors.length > 0) {
                return json(
                    {
                        ...new JsonData(false, "error", "There was an error with your request", errors, stepData),
                    },
                    { status: 400 },
                );
            }

            try {
                //Adding the products data to the step
                if (stepData.stepType === StepType.PRODUCT) {
                    bundleBuilderProductStepService.updateStep(stepData as BundleStepProduct);
                }
                //Adding the content inputs to the step
                else if (stepData.stepType === StepType.CONTENT) {
                    bundleBuilderContentStepService.updateStep(stepData as BundleStepContent);
                }

                // Clear the cache for the bundle
                const cacheKeyService = new ApiCacheKeyService(session.shop);

                await Promise.all([
                    ApiCacheService.singleKeyDelete(cacheKeyService.getStepKey(stepData.stepNumber.toString(), params.bundleid as string)),
                    ApiCacheService.singleKeyDelete(cacheKeyService.getBundleDataKey(params.bundleid as string)),
                ]);

                return redirect(`/app/edit-bundle-builder/${params.bundleid}`);
            } catch (error) {
                console.log(error);
                return json(
                    {
                        ...new JsonData(false, "error", "There was an error with your request"),
                    },
                    { status: 400 },
                );
            }
        }

        default:
            return json(
                {
                    ...new JsonData(true, "success", "This is the default action that doesn't do anything"),
                },
                { status: 200 },
            );
    }
};

export default function Index() {
    const nav = useNavigation();
    const isLoading = nav.state === "loading";
    const isSubmitting = nav.state === "submitting";

    return <>{isLoading || isSubmitting ? <SkeletonPage primaryAction fullWidth></SkeletonPage> : <Outlet />}</>;
}
