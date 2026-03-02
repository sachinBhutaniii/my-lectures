import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Only allow S3 URLs from our bucket
  if (!url.startsWith("https://bddsm-vani.s3.")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return new NextResponse("Upstream error", { status: upstream.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "audio/mpeg");
  const cl = upstream.headers.get("Content-Length");
  if (cl) headers.set("Content-Length", cl);
  headers.set("Cache-Control", "public, max-age=86400");

  return new NextResponse(upstream.body, { status: 200, headers });
}
