import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.config.findFirst();
    return NextResponse.json({
      intervalDays: config?.intervalDays ?? null,
      awardAmount: config?.awardAmount ?? null,
    });
  } catch (error) {
    console.error("[GET /api/config] Error:", error);
    return NextResponse.json(
      { error: "获取配置失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { intervalDays, awardAmount } = body as {
      intervalDays?: number;
      awardAmount?: number;
    };

    const interval =
      typeof intervalDays === "number" ? Math.max(0, Math.floor(intervalDays)) : undefined;
    const amount =
      typeof awardAmount === "number" ? Math.max(0, Math.floor(awardAmount)) : undefined;

    if (interval === undefined && amount === undefined) {
      return NextResponse.json(
        { error: "请至少提供 intervalDays 或 awardAmount" },
        { status: 400 }
      );
    }

    const config = await prisma.config.findFirst();

    if (!config) {
      const created = await prisma.config.create({
        data: {
          intervalDays: interval ?? 7,
          awardAmount: amount ?? 1,
        },
      });
      return NextResponse.json({
        intervalDays: created.intervalDays,
        awardAmount: created.awardAmount,
      });
    }

    const updated = await prisma.config.update({
      where: { id: config.id },
      data: {
        ...(interval !== undefined && { intervalDays: interval }),
        ...(amount !== undefined && { awardAmount: amount }),
      },
    });
    return NextResponse.json({
      intervalDays: updated.intervalDays,
      awardAmount: updated.awardAmount,
    });
  } catch (error) {
    console.error("[PATCH /api/config] Error:", error);
    return NextResponse.json(
      { error: "保存配置失败" },
      { status: 500 }
    );
  }
}
