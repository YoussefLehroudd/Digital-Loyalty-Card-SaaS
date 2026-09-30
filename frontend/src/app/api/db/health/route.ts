import { NextResponse } from "next/server";

import { getSql } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`select now() as now`;

    return NextResponse.json({
      ok: true,
      database: "neon-postgres",
      now: rows[0]?.now ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "neon-postgres",
        message: error instanceof Error ? error.message : "Database health check failed",
      },
      { status: 500 },
    );
  }
}
