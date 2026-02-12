import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  // In this route, `params` is a Promise at runtime,
  // so we type it accordingly and always `await` it.
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  console.log("STUDENTID", context.params);
  const params = await context.params;
  const id = Number(params.id);

  if (!id || Number.isNaN(id)) {
    return NextResponse.json(
      { error: "Invalid student id" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { name, studentId } = body as {
      name?: string;
      studentId?: string;
    };

    const updates: { name?: string; studentId?: string } = {};

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = trimmed;
    }

    if (typeof studentId === "string") {
      const trimmed = studentId.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "studentId cannot be empty" },
          { status: 400 }
        );
      }
      updates.studentId = trimmed;
    }

    if (!updates.name && !updates.studentId) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const student = await prisma.student.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ student });
  } catch (error: any) {
    console.error("[PATCH /api/students/:id] Error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "StudentId already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update student" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const params = await context.params;
  const id = Number(params.id);

  if (!id || Number.isNaN(id)) {
    return NextResponse.json(
      { error: "Invalid student id" },
      { status: 400 }
    );
  }

  try {
    await prisma.student.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/students/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 }
    );
  }
}

