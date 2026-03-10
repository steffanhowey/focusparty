import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/party", "/session", "/settings", "/progress", "/onboard", "/admin"];

export async function updateSession(request: NextRequest) {
  // Don't interfere with the auth callback — the route handler
  // needs the PKCE code-verifier cookie intact.
  if (request.nextUrl.pathname.startsWith("/callback")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — validates the JWT and refreshes expired tokens.
  // Do NOT add code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes.
  const { pathname } = request.nextUrl;
  if (
    !user &&
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users who haven't completed onboarding.
  // Uses a cookie cache to skip the DB query on subsequent requests.
  if (
    user &&
    !pathname.startsWith("/onboard") &&
    !pathname.startsWith("/callback") &&
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    const onboardingCookie = request.cookies.get("fp_onboarded")?.value;

    if (onboardingCookie !== "1") {
      const { data: profile } = await supabase
        .from("fp_profiles")
        .select("onboarding_completed, username")
        .eq("id", user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        const onboardUrl = request.nextUrl.clone();
        onboardUrl.pathname = "/onboard";
        onboardUrl.search = "";
        return NextResponse.redirect(onboardUrl);
      }

      // Force re-onboarding for users who completed onboarding but have no username
      if (profile?.onboarding_completed && !profile.username) {
        const onboardUrl = request.nextUrl.clone();
        onboardUrl.pathname = "/onboard";
        onboardUrl.searchParams.set("step", "username");
        return NextResponse.redirect(onboardUrl);
      }

      if (profile?.onboarding_completed && profile.username) {
        supabaseResponse.cookies.set("fp_onboarded", "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
    }
  }

  return supabaseResponse;
}
