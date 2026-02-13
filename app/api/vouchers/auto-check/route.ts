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

/**
 * 自动发券检查：遍历所有学生，按 intervalDays/awardAmount 计算应发券数，
 * 在事务中更新 balance、lastAwardDate 并写入 VoucherLog(type: 'auto')。
 * 日期在 Asia/Shanghai 下计算，同一天多次调用会因 diffDays < intervalDays 而跳过。
 */
export async function GET() {
  try {
    const config = await prisma.config.findFirst();
    const intervalDays = config?.intervalDays ?? 0;
    const awardAmount = config?.awardAmount ?? 0;

    if (!intervalDays || intervalDays <= 0 || !awardAmount || awardAmount <= 0) {
      return NextResponse.json({
        studentCount: 0,
        totalAwarded: 0,
        message: "未配置发券规则或单次发放张数为 0，跳过自动发券",
      });
    }

    const todayStr = getShanghaiDateStr(new Date());
    const students = await prisma.student.findMany({
      select: { id: true, studentId: true, balance: true, lastAwardDate: true, createdAt: true },
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
      return NextResponse.json({ studentCount: 0, totalAwarded: 0 });
    }

    let totalAwarded = 0;
    await prisma.$transaction(async (tx) => {
      for (const { studentId, addBalance, newLastAwardDate } of toAward) {
        await tx.student.update({
          where: { id: studentId },
          data: {
            balance: { increment: addBalance },
            lastAwardDate: newLastAwardDate,
          },
        });
        await tx.voucherLog.create({
          data: {
            studentId,
            changeAmount: addBalance,
            reason: "自动发券",
            type: "auto",
          },
        });
        totalAwarded += addBalance;
      }
    });

    return NextResponse.json({
      studentCount: toAward.length,
      totalAwarded,
    });
  } catch (error) {
    console.error("[GET /api/vouchers/auto-check] Error:", error);
    return NextResponse.json(
      { error: "自动发券检查失败" },
      { status: 500 }
    );
  }
}
