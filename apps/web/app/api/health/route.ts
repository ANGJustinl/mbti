import { NextResponse } from "next/server";

import { prisma } from "../../../lib/db";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json({
      ok: true,
      service: "web",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "web",
        database: "error",
        error: error instanceof Error ? error.message : "health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
