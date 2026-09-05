import { createLoader } from "nuqs/server";

import { usageParams, type UsageParams } from "../params";

export const usageParamsLoader = createLoader(usageParams);

export type { UsageParams };
