"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Minus, RefreshCcw } from "lucide-react";

export type StudentWithNext = {
  id: number;
  name: string;
  studentId: string;
  balance: number;
  lastAwardDate: string | null;
  createdAt: string;
  nextAwardDate?: string | null;
};

type VoucherLogItem = {
  id: number;
  changeAmount: number;
  reason: string;
  type: "manual" | "auto";
  createdAt: string;
  student: {
    name: string;
    studentId: string;
  };
};

type Props = {
  initialStudents: StudentWithNext[];
  intervalDays: number | null;
};

export function ClientDashboard({ initialStudents, intervalDays }: Props) {
  const [students, setStudents] = useState<StudentWithNext[]>(initialStudents);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [logs, setLogs] = useState<VoucherLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingDelta, setPendingDelta] = useState<number | null>(null);
  const [pendingStudent, setPendingStudent] = useState<StudentWithNext | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedSelectedDate = useMemo(
    () => (selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""),
    [selectedDate]
  );

  useEffect(() => {
    if (!selectedDate) return;
    const controller = new AbortController();
    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        setError(null);
        const res = await fetch(
          `/api/vouchers/logs?date=${formattedSelectedDate}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "获取日志失败");
        }
        const data = (await res.json()) as { logs: VoucherLogItem[] };
        setLogs(data.logs);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message ?? "获取日志时出错");
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
    return () => controller.abort();
  }, [formattedSelectedDate, selectedDate]);

  const openAdjustDialog = (student: StudentWithNext, delta: number) => {
    setPendingStudent(student);
    setPendingDelta(delta);
    setReason("");
    setError(null);
    setReasonDialogOpen(true);
  };

  const handleSubmitAdjust = async () => {
    if (!pendingStudent || pendingDelta === null) return;
    if (!reason.trim()) {
      setError("请填写变动理由");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/vouchers/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: pendingStudent.studentId,
          delta: pendingDelta,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "调整失败");
      }
      const updated = data.student as StudentWithNext;
      setStudents((prev) =>
        prev.map((s) =>
          s.id === updated.id ? { ...s, balance: updated.balance } : s
        )
      );
      setReasonDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (student: StudentWithNext) => {
    if (!confirm(`确定要重置 ${student.name} 的计时吗？`)) return;
    try {
      setError(null);
      const res = await fetch("/api/vouchers/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.studentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "重置失败");
      }
      const updated = data.student as {
        id: number;
        lastAwardDate: string | null;
        createdAt: string;
      };
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== updated.id) return s;
          const lastAwardDate = updated.lastAwardDate;
          let nextAwardDate = s.nextAwardDate;
          if (intervalDays && intervalDays > 0 && lastAwardDate) {
            const base = new Date(lastAwardDate);
            base.setDate(base.getDate() + intervalDays);
            nextAwardDate = base.toISOString();
          }
          return {
            ...s,
            lastAwardDate,
            nextAwardDate,
          };
        })
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "重置失败");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900">
            管理后台 - 迟交券
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            查看学生当前余券、预计发券日期，并支持快速增减与重置计时。
          </p>
        </header>

        {intervalDays ? (
          <div className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700">
            当前配置：每{" "}
            <span className="font-semibold">{intervalDays}</span> 天自动发放一次迟交券。
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            尚未配置发券规则（Config），预计发券日期将无法计算。
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-[2fr,1.3fr] items-start">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">
                学生列表
              </h2>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>学号</TableHead>
                  <TableHead>当前余券</TableHead>
                  <TableHead>下次发券预估</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-500">
                      暂无学生数据，请先通过 API 或其它页面添加学生。
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {s.studentId}
                      </TableCell>
                      <TableCell>{s.balance}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {s.nextAwardDate
                          ? format(
                              new Date(s.nextAwardDate),
                              "yyyy-MM-dd",
                              { locale: zhCN }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openAdjustDialog(s, -1)}
                            aria-label="减少 1 张"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openAdjustDialog(s, 1)}
                            aria-label="增加 1 张"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleReset(s)}
                            aria-label="重置计时"
                          >
                            <RefreshCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                日历查询
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                选择日期后，下方显示当天所有迟交券变动记录。
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={zhCN}
              />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-700">
                  选择日期：{" "}
                  <span className="font-medium">
                    {selectedDate
                      ? format(selectedDate, "yyyy-MM-dd", { locale: zhCN })
                      : "未选择"}
                  </span>
                </div>
                {loadingLogs && (
                  <div className="text-xs text-zinc-400">加载中...</div>
                )}
              </div>
              {logs.length === 0 ? (
                <div className="py-4 text-center text-sm text-zinc-500">
                  当天暂无变动记录。
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 text-sm">
                  {logs.map((log) => (
                    <li key={log.id} className="py-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {log.student.name} ({log.student.studentId})
                        </span>
                        <span
                          className={
                            log.changeAmount >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }
                        >
                          {log.changeAmount > 0 ? "+" : ""}
                          {log.changeAmount}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {format(new Date(log.createdAt), "HH:mm:ss")} ·{" "}
                        {log.type === "manual" ? "手动调整" : "自动发券"}
                      </div>
                      <div className="text-xs text-zinc-600">
                        理由：{log.reason}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>请输入变动理由</DialogTitle>
              <DialogDescription>
                正在为{" "}
                <span className="font-semibold">
                  {pendingStudent?.name ?? ""}
                </span>{" "}
                {pendingDelta && pendingDelta > 0 ? "增加" : "减少"}{" "}
                {Math.abs(pendingDelta ?? 0)} 张迟交券。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <textarea
                className="w-full min-h-[80px] rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                placeholder="请输入调整原因，便于后续查询记录"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setReasonDialogOpen(false)}
                  disabled={submitting}
                >
                  取消
                </Button>
                <Button onClick={handleSubmitAdjust} disabled={submitting}>
                  {submitting ? "提交中..." : "确认提交"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

