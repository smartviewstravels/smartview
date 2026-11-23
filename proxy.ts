import { NextResponse, type NextRequest } from "next/server";

// Exposes the current pathname to server components as the x-pathname
// request header, so the layout can highlight the active nav link on
// full page loads too (client navigation already sends next-url).
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
