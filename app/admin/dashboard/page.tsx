import { prisma } from "@/lib/prisma";
import { ClientDashboard, type StudentWithNext } from "./client-dashboard";

async function getInitialData() {
  const [students, config] = await Promise.all([
    prisma.student.findMany({
      orderBy: { id: "asc" },
    }),
    prisma.config.findFirst(),
  ]);

  const intervalDays = config?.intervalDays ?? null;

  const computeNextAwardDate = (
    lastAwardDate: Date | null,
    createdAt: Date
  ): string | null => {
    if (!intervalDays || intervalDays <= 0) return null;
    const base = lastAwardDate ?? createdAt;
    const d = new Date(base);
    d.setDate(d.getDate() + intervalDays);
    return d.toISOString();
  };

  const initialStudents: StudentWithNext[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    studentId: s.studentId,
    balance: s.balance,
    lastAwardDate: s.lastAwardDate ? s.lastAwardDate.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    nextAwardDate: computeNextAwardDate(
      s.lastAwardDate ?? null,
      s.createdAt
    ),
  }));

  return { initialStudents, intervalDays };
}

export default async function AdminDashboardPage() {
  const { initialStudents, intervalDays } = await getInitialData();

  return (
    <ClientDashboard
      initialStudents={initialStudents}
      intervalDays={intervalDays}
    />
  );
}

