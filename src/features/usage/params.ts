import { parseAsInteger, parseAsString, type inferParserType } from "nuqs/server";

export const usageParams = {
  days: parseAsInteger.withDefault(30).withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  limit: parseAsInteger.withDefault(25).withOptions({ clearOnDefault: true }),
  operation: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

export type UsageParams = inferParserType<typeof usageParams>;
