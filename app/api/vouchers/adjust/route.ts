import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, delta, reason } = body as {
      studentId?: string;
      delta?: number;
      reason?: string;
    };

    if (!studentId || typeof delta !== "number") {
      return NextResponse.json(
        { error: "studentId and delta are required" },
        { status: 400 }
      );
    }
    const student = await prisma.student.findUnique({
      where: { studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const newBalance = student.balance + Math.floor(delta);

    const [updatedStudent] = await prisma.$transaction([
      prisma.student.update({
        where: { id: student.id },
        data: { balance: newBalance },
      }),
      prisma.voucherLog.create({
        data: {
          studentId: student.id,
          changeAmount: Math.floor(delta),
          // 变动理由改为可选，后端允许为空字符串
          reason: reason ?? "",
          type: "manual",
        },
      }),
    ]);

    return NextResponse.json({ student: updatedStudent });
  } catch (error) {
    console.error("[POST /api/vouchers/adjust] Error:", error);
    return NextResponse.json(
      { error: "Failed to adjust voucher" },
      { status: 500 }
    );
  }
}

