import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;

  if (!code || typeof code !== "string" || code.length !== 6) {
    return NextResponse.json({ message: "Not Found" }, { status: 404 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/public/short-urls/${encodeURIComponent(code)}`,
      { cache: "no-store" },
    );

    if (response.status === 404) {
      return NextResponse.json({ message: "Not Found" }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 502 },
      );
    }

    const data: {
      originalUrl: string;
      expiresAt?: string | null;
    } = await response.json();

    // Check if expired
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return NextResponse.json({ message: "Gone" }, { status: 410 });
    }

    // 302 redirect (temporary — allows click tracking per request)
    return NextResponse.redirect(data.originalUrl, 302);
  } catch {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 502 },
    );
  }
}
