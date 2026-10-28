import { NextResponse } from "next/server";

// The upstream diagnostic endpoint exposed environment values. It is retired.
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
