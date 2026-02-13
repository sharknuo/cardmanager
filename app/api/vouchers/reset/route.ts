import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VoucherType } from "@/src/generated/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, reason } = body as { studentId?: string; reason?: string };

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const now = new Date();

    const [updatedStudent] = await prisma.$transaction([
      prisma.student.update({
        where: { id: student.id },
        data: {
          lastAwardDate: now,
        },
      }),
      prisma.voucherLog.create({
        data: {
          studentId: student.id,
          changeAmount: 0,
          reason: reason ?? "",
          type: VoucherType.reset,
        },
      }),
    ]);

    return NextResponse.json({ student: updatedStudent });
  } catch (error) {
    console.error("[POST /api/vouchers/reset] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset award timer" },
      { status: 500 }
    );
  }
}

