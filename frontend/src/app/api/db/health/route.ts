import { NextResponse } from "next/server";

import { getSql } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthRow = {
  now: string;
};

export async function GET() {
  try {
    const sql = getSql();
    const rows = (await sql`select now()::text as now`) as HealthRow[];

    return NextResponse.json({
      ok: true,
      database: "neon-postgres",
      now: rows.at(0)?.now ?? null,
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
