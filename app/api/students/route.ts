import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function computeNextAwardDate(
  lastAwardDate: Date | null,
  createdAt: Date,
  intervalDays: number | null
): Date | null {
  if (!intervalDays || intervalDays <= 0) return null;
  const base = lastAwardDate ?? createdAt;
  const next = new Date(base);
  next.setDate(next.getDate() + intervalDays);
  return next;
}

export async function GET() {
  try {
    const [students, config] = await Promise.all([
      prisma.student.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.config.findFirst(),
    ]);

    const intervalDays = config?.intervalDays ?? null;

    const data = students.map((s) => ({
      ...s,
      nextAwardDate: computeNextAwardDate(
        s.lastAwardDate ?? null,
        s.createdAt,
        intervalDays
      )?.toISOString(),
    }));

    return NextResponse.json({ students: data, intervalDays });
  } catch (error) {
    console.error("[GET /api/students] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, studentId, initialBalance } = body as {
      name?: string;
      studentId?: string;
      initialBalance?: number;
    };

    if (!name || !studentId) {
      return NextResponse.json(
        { error: "name and studentId are required" },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        name,
        studentId,
        balance:
          typeof initialBalance === "number" ? Math.floor(initialBalance) : 0,
      },
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/students] Error:", error);
    if (error.code === "P2002") {
      // unique constraint failed
      return NextResponse.json(
        { error: "StudentId already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    );
  }
}

