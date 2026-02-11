import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date"); // legacy single-date support
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const pageParam = searchParams.get("page") ?? "1";
    const pageSizeParam = searchParams.get("pageSize") ?? "20";

    const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
    // Hard cap pageSize to avoid accidental huge queries
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeParam, 10) || 20)
    );

    // Build createdAt filter (support legacy `date`, or range via startDate/endDate)
    let createdAtFilter: Record<string, Date> = {};

    if (dateStr) {
      // Legacy: single-day query, keep behavior
      const date = new Date(dateStr + "T00:00:00.000Z");
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      const start = date;
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      createdAtFilter = {
        gte: start,
        lt: end,
      };
    } else if (startDateStr || endDateStr) {
      let start: Date | undefined;
      let endExclusive: Date | undefined;

      if (startDateStr) {
        const d = new Date(startDateStr + "T00:00:00.000Z");
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Invalid startDate format" },
            { status: 400 }
          );
        }
        start = d;
      }

      if (endDateStr) {
        const d = new Date(endDateStr + "T00:00:00.000Z");
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Invalid endDate format" },
            { status: 400 }
          );
        }
        const e = new Date(d);
        // Make end inclusive for the whole day: [start, end + 1 day)
        e.setUTCDate(e.getUTCDate() + 1);
        endExclusive = e;
      }

      if (start && endExclusive) {
        createdAtFilter = {
          gte: start,
          lt: endExclusive,
        };
      } else if (start) {
        createdAtFilter = {
          gte: start,
        };
      } else if (endExclusive) {
        createdAtFilter = {
          lt: endExclusive,
        };
      }
    }

    const where =
      Object.keys(createdAtFilter).length > 0
        ? { createdAt: createdAtFilter }
        : {};

    const [total, logs] = await Promise.all([
      prisma.voucherLog.count({ where }),
      prisma.voucherLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          student: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[GET /api/vouchers/logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

