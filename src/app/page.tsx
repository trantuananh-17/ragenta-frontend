import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

/**
 * The root has nothing of its own to show: the marketing site is a different
 * deployable, and a signed-in user wants the thing they came for.
 */
export default async function RootPage() {
  redirect((await getSession()) ? "/chat" : "/login");
}
