import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { homedir } from "os";
import path, { join } from "path";
import { initConfig, initDir, cleanupLogFiles } from "./utils";
import { createServer } from "./server";
import { router } from "./utils/router";
import { apiKeyAuth } from "./middleware/auth";
import { requestLogger } from "./utils/requestLogger";
import { httpInterceptor } from "./utils/httpInterceptor";
import {
  cleanupPidFile,
  isServiceRunning,
  savePid,
} from "./utils/processCheck";
import { CONFIG_FILE } from "./constants";
import createWriteStream from "pino-rotating-file-stream";
import { HOME_DIR } from "./constants";

async function initializeClaudeConfig() {
  const homeDir = homedir();
  const configPath = join(homeDir, ".claude.json");
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

interface RunOptions {
  port?: number;
}

async function run(options: RunOptions = {}) {
  // Check if service is already running
  if (isServiceRunning()) {
    console.log("✅ Service is already running in the background.");
    return;
  }

  await initializeClaudeConfig();
  await initDir();
  // Clean up old log files, keeping only the 10 most recent ones
  await cleanupLogFiles();
  const config = await initConfig();
  let HOST = config.HOST;

  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
    console.warn("⚠️ API key is not set. HOST is forced to 127.0.0.1.");
  }

  const port = config.PORT || 3456;

  // Save the PID of the background process
  savePid(process.pid);

  // Handle SIGINT (Ctrl+C) to clean up PID file
  process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up...");
    cleanupPidFile();
    process.exit(0);
  });

  // Handle SIGTERM to clean up PID file
  process.on("SIGTERM", () => {
    cleanupPidFile();
    process.exit(0);
  });
  console.log(HOST);

  // Use port from environment variable if set (for background process)
  const servicePort = process.env.SERVICE_PORT
    ? parseInt(process.env.SERVICE_PORT)
    : port;

  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      // ...config,
      providers: config.Providers || config.providers,
      HOST: HOST,
      PORT: servicePort,
      LOG_FILE: join(
        homedir(),
        ".claude-code-router",
        "claude-code-router.log"
      ),
    },
    logger: {
      level: "debug",
      stream: createWriteStream({
        path: HOME_DIR,
        filename: config.LOGNAME || `./logs/ccr-${+new Date()}.log`,
        maxFiles: 3,
        interval: "1d",
      }),
    },
  });
  // Add async preHandler hook for authentication
  server.addHook("preHandler", async (req: any, reply: any) => {
    return new Promise<void>((resolve, reject) => {
      const done = (err?: Error) => {
        if (err) reject(err);
        else resolve();
      };
      // Call the async auth function
      apiKeyAuth(config)(req, reply, done).catch(reject);
    });
  });
  // 安装HTTP拦截器以记录请求转换过程
  httpInterceptor.install();

  server.addHook("preHandler", async (req: any, reply: any) => {
    if (req.url.startsWith("/v1/messages")) {
      // 记录请求开始时间
      (req as any).startTime = Date.now();

      // 设置当前请求ID到全局上下文，供HTTP拦截器使用
      if ((req as any).requestId) {
        const { httpInterceptor: interceptor } = await import("./utils/httpInterceptor");
        (interceptor.constructor as any).setCurrentRequestId((req as any).requestId);
      }

      router(req, reply, config);
    }
  });

  // 添加响应日志中间件
  server.addHook("onSend", async (req: any, reply: any, payload: any) => {
    if (req.url.startsWith("/v1/messages") && (req as any).requestId) {
      const requestId = (req as any).requestId;
      const startTime = (req as any).startTime || Date.now();

      try {
        // 解析响应体
        let responseBody = payload;
        if (typeof payload === 'string') {
          try {
            responseBody = JSON.parse(payload);
          } catch (e) {
            responseBody = payload;
          }
        }

        requestLogger.logResponse(
          requestId,
          reply.statusCode,
          reply.getHeaders(),
          responseBody,
          startTime
        );

        // 清理全局请求ID上下文
        const { httpInterceptor: interceptor } = await import("./utils/httpInterceptor");
        (interceptor.constructor as any).clearCurrentRequestId();
      } catch (error: any) {
        requestLogger.logError(requestId, error);

        // 即使出错也要清理上下文
        const { httpInterceptor: interceptor } = await import("./utils/httpInterceptor");
        (interceptor.constructor as any).clearCurrentRequestId();
      }
    }
    return payload;
  });

  server.start();
}

export { run };
// run();
