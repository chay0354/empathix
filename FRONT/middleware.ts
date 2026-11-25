import { NextResponse, type NextRequest } from "next/server";

/** Optional shared password (DEMO_PASSWORD) so a public demo URL can't burn the API key. */
export function middleware(req: NextRequest) {
  const pass = process.env.DEMO_PASSWORD;
  if (!pass) return NextResponse.next();
  const auth = req.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const pwd = decoded.slice(decoded.indexOf(":") + 1);
    if (pwd === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Empathix demo"' }
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
