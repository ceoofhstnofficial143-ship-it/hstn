import { NextResponse, type NextRequest } from "next/server"

// Auth is enforced in protected pages (they redirect to /login if !user).
// Session lives in localStorage with client-only Supabase SDK.
export async function middleware(request: NextRequest) {
  // No auth check here (session is in localStorage). Protected pages handle redirect.
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
