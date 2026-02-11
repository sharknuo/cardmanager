import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId } = body as { studentId?: string };

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

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        lastAwardDate: now,
      },
    });

    return NextResponse.json({ student: updatedStudent });
  } catch (error) {
    console.error("[POST /api/vouchers/reset] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset award timer" },
      { status: 500 }
    );
  }
}

