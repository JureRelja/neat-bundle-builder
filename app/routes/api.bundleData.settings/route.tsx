import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import db from '~/db.server';
import { JsonData } from '~/types/jsonData';
import { checkPublicAuth } from '~/utils/publicApi.auth';
import { ApiCacheService } from '../../service/impl/ApiCacheService';
import { settingsIncludeAll, SettingsWithAllResources } from '~/types/BundleSettings';
import { ApiCacheKeyService } from '~/service/impl/ApiCacheKeyService';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const res = await checkPublicAuth(request); //Public auth check
    if (!res.ok)
        return json(res, {
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            status: 200,
        });

    const url = new URL(request.url);

    //Get query params
    const bundleBuilderId = url.searchParams.get('bundleId');
    const stepNumber = url.searchParams.get('stepNum');
    const storeUrl = url.searchParams.get('shop') as string;

    //Cache aside
    const cacheKey = new ApiCacheKeyService(storeUrl);

    const cache = new ApiCacheService(cacheKey.getBundleSettingsKey(url.searchParams.get('bundleId')));

    const cacheData = await cache.readCache();

    if (cacheData) {
        return json(new JsonData(true, 'success', 'Bundle settings succesfuly retirieved.', [], cacheData, true), {
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            status: 200,
        });
    } else {
        try {
            let bundleSettings: SettingsWithAllResources | null = await db.bundleSettings.findUnique({
                where: {
                    bundleBuilderId: Number(bundleBuilderId),
                },
                include: settingsIncludeAll,
            });

            if (!bundleSettings) {
                return json(new JsonData(false, 'error', "There was an error with your request. 'stepNum' doesn't exist for this bundle."), {
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                    status: 200,
                });
            }

            //Write to cache
            await cache.writeCache(bundleSettings);

            return json(new JsonData(false, 'success', 'Bundle settings succesfuly retirieved.', [], bundleSettings), {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                status: 200,
            });
        } catch (error) {
            console.log(error);
        }
    }
};
