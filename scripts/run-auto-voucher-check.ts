import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runAutoVoucherCheck } from "@/app/api/vouchers/auto-check/route";

/**
 * 供服务端 cron 调用的脚本。
 *
 * 示例（Linux crontab，上海时间每天 0 点）：
 * 0 0 * * * cd /path/to/cardManager && /usr/bin/env NODE_OPTIONS="--require ts-node/register --require tsconfig-paths/register" node scripts/run-auto-voucher-check.ts >> logs/auto-voucher.log 2>&1
 *
 * 实际使用时，请根据你的运行环境调整 node 路径、ts-node/tsx 方式等。
 */
async function main() {
  try {
    const result = await runAutoVoucherCheck();
    console.log(
      `[auto-voucher] ${new Date().toISOString()} studentCount=${result.studentCount} totalAwarded=${result.totalAwarded} message=${result.message ?? ""
      }`
    );
  } catch (err) {
    console.error("[auto-voucher] failed to run auto voucher check", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// 仅当作为独立脚本执行时运行
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

