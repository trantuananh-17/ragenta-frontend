import { Hono } from "hono";
import { proxy } from "hono/proxy";

import { RAGENTA_API_URL } from "@/lib/server-fetch";

/**
 * Better Auth lives inside `ragenta-backend` at `/v1/auth/*`. This is a thin
 * pass-through: the session cookie is the credential in both directions, so the
 * only thing to get right is not mangling it.
 */
const authProxy = new Hono();

authProxy.all("/*", async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/api\/auth\/?/, "");
  const target = `${RAGENTA_API_URL}/v1/auth/${path}${url.search}`;

  try {
    const response = await proxy(target, {
      ...c.req,
      headers: {
        ...c.req.header(),
        "X-Forwarded-Host": c.req.header("host") ?? "",
      },
    });

    // Dev only. A backend served over HTTPS may scope its session cookie to its
    // own domain (AUTH_COOKIE_DOMAIN), which a browser on localhost will not
    // store — login then silently never sticks. Drop the Domain attribute so the
    // cookie binds host-only. `Secure` is kept, which localhost is allowed to
    // accept. Never runs in production.
    if (process.env.NODE_ENV !== "production") {
      const setCookies = response.headers.getSetCookie();
      if (setCookies.length > 0) {
        const headers = new Headers(response.headers);
        headers.delete("set-cookie");
        for (const cookie of setCookies) {
          headers.append("set-cookie", cookie.replace(/;\s*Domain=[^;]*/gi, ""));
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  } catch (error) {
    return c.json(
      {
        error: {
          code: "AUTH_PROXY_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      502,
    );
  }
});

export { authProxy };
