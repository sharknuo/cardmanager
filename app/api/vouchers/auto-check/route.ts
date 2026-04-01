import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

const MS_PER_DAY = 86400000;

const TIMEZONE = "Asia/Shanghai";

/** 获取某个时刻在 Asia/Shanghai 的日历日期字符串 YYYY-MM-DD */
function getShanghaiDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** 将 Shanghai 的 YYYY-MM-DD 转为该日 00:00:00 在 Shanghai 对应的 UTC Date */
function startOfDayShanghai(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 2025-02-13 00:00 Asia/Shanghai = 2025-02-12 16:00 UTC
  return new Date(Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000);
}

/** 在 Shanghai 日期上加 days 天，返回新的 YYYY-MM-DD */
function addDaysShanghai(dateStr: string, days: number): string {
  const start = startOfDayShanghai(dateStr);
  const next = addDays(start, days);
  return getShanghaiDateStr(next);
}

export type AutoVoucherResult = {
  studentCount: number;
  totalAwarded: number;
  message?: string;
};

/**
 * 核心自动发券逻辑。
 * - 遍历所有学生，按 intervalDays/awardAmount 计算应发券数；
 * - 在事务中更新 balance、lastAwardDate 并写入 VoucherLog(type: 'auto')；
 * - 日期在 Asia/Shanghai 下计算，同一天多次调用会因 diffDays < intervalDays 而跳过。
 *
 * 可被：
 * - API 路由 GET /api/vouchers/auto-check 调用
 * - 独立脚本/定时任务调用（例如每天 0:00 触发）
 */
export async function runAutoVoucherCheck(): Promise<AutoVoucherResult> {
  const config = await prisma.config.findFirst();
  const intervalDays = config?.intervalDays ?? 0;
  const awardAmount = config?.awardAmount ?? 0;

  if (!intervalDays || intervalDays <= 0 || !awardAmount || awardAmount <= 0) {
    return {
      studentCount: 0,
      totalAwarded: 0,
      message: "未配置发券规则或单次发放张数为 0，跳过自动发券",
    };
  }

  const todayStr = getShanghaiDateStr(new Date());
  const students = await prisma.student.findMany({
    select: {
      id: true,
      studentId: true,
      balance: true,
      lastAwardDate: true,
      createdAt: true,
    },
  });

  type Award = { studentId: number; addBalance: number; newLastAwardDate: Date };
  const toAward: Award[] = [];

  for (const s of students) {
    const baseDate = s.lastAwardDate ?? s.createdAt;
    const baseStr = getShanghaiDateStr(baseDate);
    const baseStart = startOfDayShanghai(baseStr);
    const todayStart = startOfDayShanghai(todayStr);
    const diffDays = Math.floor(
      (todayStart.getTime() - baseStart.getTime()) / MS_PER_DAY
    );

    if (diffDays < intervalDays) continue;

    const count = Math.floor(diffDays / intervalDays);
    const addBalance = count * awardAmount;
    const newDateStr = addDaysShanghai(baseStr, count * intervalDays);
    const newLastAwardDate = startOfDayShanghai(newDateStr);

    toAward.push({ studentId: s.id, addBalance, newLastAwardDate });
  }

  if (toAward.length === 0) {
    return { studentCount: 0, totalAwarded: 0 };
  }

  const totalAwarded = toAward.reduce(
    (sum, { addBalance }) => sum + addBalance,
    0
  );

  const txOps = toAward.flatMap(({ studentId, addBalance, newLastAwardDate }) => [
    prisma.student.update({
      where: { id: studentId },
      data: {
        balance: { increment: addBalance },
        lastAwardDate: newLastAwardDate,
      },
    }),
    prisma.voucherLog.create({
      data: {
        studentId,
        changeAmount: addBalance,
        reason: "自动发券",
        type: "auto",
      },
    }),
  ]);

  await prisma.$transaction(txOps);

  return {
    studentCount: toAward.length,
    totalAwarded,
  };
}

/**
 * 仍然保留 GET 接口，方便手动调试 / 触发一次自动发券。
 * 但「什么时候检测」应该交给服务端定时任务，而不是前端页面进入时触发。
 *
 * 为了防止被任意人调用，这里要求携带正确的 Authorization 头：
 * Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron 会自动在请求里加入该 header（你需要在项目环境变量里配置 CRON_SECRET）。
 */
export async function GET(request: Request) {
  try {
    // if (
    //   request.headers.get("authorization") !==
    //   `Bearer ${process.env.CRON_SECRET}`
    // ) {
    //   return NextResponse.json(
    //     { error: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }

    const result = await runAutoVoucherCheck();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/vouchers/auto-check] Error:", error);
    return NextResponse.json(
      { error: "自动发券检查失败" },
      { status: 500 }
    );
  }
}
