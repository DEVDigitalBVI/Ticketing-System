import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnvironment } from "@/config/public";

const protectedPaths = new Set(["/", "/new-ticket", "/my-tickets", "/technician"]);

function isProtected(pathname: string) {
  return (
    protectedPaths.has(pathname) || pathname.startsWith("/account/") || pathname.startsWith("/admin/")
  );
}

function copyAuthState(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) destination.headers.set(name, value);
  }
  destination.headers.set("Cache-Control", "private, no-store");
  return destination;
}

export async function updateAuthSession(request: NextRequest) {
  const environment = getPublicEnvironment();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  if (!authenticated && isProtected(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("next", pathname);
    return copyAuthState(response, NextResponse.redirect(destination));
  }

  if (authenticated && pathname === "/login") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/";
    destination.search = "";
    return copyAuthState(response, NextResponse.redirect(destination));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
