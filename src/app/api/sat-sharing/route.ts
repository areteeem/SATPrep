import { NextRequest, NextResponse } from "next/server";
// Keep the existing service's production Origin contract when authoring locally.
// This development proxy forwards the user's bearer token; the service still authorizes every action.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development")
    return new NextResponse(null, { status: 404 });
  const source = request.headers.get("origin");
  if (!source || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(source))
    return NextResponse.json(
      { error: "Invalid development origin." },
      { status: 403 },
    );
  const endpoint = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_URL?.replace(
      /\/$/,
      "",
    ),
    key = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_ANON_KEY;
  if (!endpoint || !key)
    return NextResponse.json(
      { error: "TutPro sharing is not configured." },
      { status: 503 },
    );
  const body = await request.text();
  if (body.length > 50000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const response = await fetch(`${endpoint}/functions/v1/sat_practice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://artem-sat.vercel.app",
        apikey: key,
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(25000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The sharing service is unavailable." },
      { status: 503 },
    );
  }
}
