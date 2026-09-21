#!/usr/bin/env node
/**
 * 端到端验证脚本：用 Chrome DevTools Protocol 直接驱动无头浏览器。
 *
 * 为什么不装 Playwright / Puppeteer：这个项目只需要"打开页面 → 跑一段 JS → 打印结果"，
 * 而 Node 22+ 自带 fetch 和 WebSocket，够用了。少一层框架，脚本也就 100 行，
 * 谁看都明白在干什么；也省掉了往仓库里塞一个几百 MB 的浏览器依赖。
 *
 * 用法：
 *   node scripts/cdp-check.mjs --url http://localhost:3000/
 *   node scripts/cdp-check.mjs --url http://localhost:3000/text-lab --eval-file /tmp/step.js
 *
 * 参数：
 *   --url <url>        要打开的地址（默认 http://localhost:3000/）
 *   --eval <js>        页面加载后执行的表达式（可为 async，支持 await）
 *   --eval-file <path> 从文件读表达式（长脚本用这个，省得跟 shell 引号打架）
 *   --profile <dir>    浏览器用户目录（默认 .tmp-chrome/profile，用它保留 cookie）
 *   --port <n>         远程调试端口（默认 9333）
 *   --keep-open        跑完不关浏览器（调试用）
 *   --timeout <ms>     等待浏览器的超时（默认 20000）
 *
 * 退出码：0 = 正常且无页面报错；1 = 超时/异常/页面有 console error。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const opts = {
    url: "http://localhost:3000/",
    eval: null,
    evalFile: null,
    profile: ".tmp-chrome/profile",
    port: 9333,
    keepOpen: false,
    timeout: 20000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === "--url") opts.url = next();
    else if (key === "--eval") opts.eval = next();
    else if (key === "--eval-file") opts.evalFile = next();
    else if (key === "--profile") opts.profile = next();
    else if (key === "--port") opts.port = Number(next());
    else if (key === "--keep-open") opts.keepOpen = true;
    else if (key === "--timeout") opts.timeout = Number(next());
    else throw new Error(`未知参数：${key}`);
  }
  if (opts.evalFile) opts.eval = readFileSync(opts.evalFile, "utf8");
  return opts;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "chromium",
    "chromium-browser",
    "google-chrome",
    "/home/myue/.local/bin/chromium", // 本机（沙箱）里的 Chrome for Testing 包装脚本
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
    } else {
      const found = lookupPath(candidate);
      if (found) return found;
    }
  }
  throw new Error("找不到 chrome/chromium，可用 CHROME_PATH 环境变量指定");
}

function lookupPath(bin) {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    if (!dir) continue;
    const full = path.join(dir, bin);
    if (existsSync(full)) return full;
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, { timeout, interval = 250, label }) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(`等待超时（${label}）${lastError ? `：${lastError.message}` : ""}`);
}

// ---------------------------------------------------------------- CDP 客户端

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", (event) =>
        reject(new Error(`WebSocket 错误：${event.message ?? "unknown"}`)),
      );
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* 已经关了 */
    }
  }
}

// 把页面里的 console error / 未捕获异常 / 网络错误收集起来——"控制台无报错"要真看，不能靠猜
function collectProblems(events) {
  const errors = [];
  const warnings = [];
  for (const event of events) {
    if (event.method === "Runtime.consoleAPICalled") {
      const text = (event.params.args ?? [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ");
      if (event.params.type === "error") errors.push(`console.error: ${text}`);
      else if (event.params.type === "warning") warnings.push(`console.warn: ${text}`);
    } else if (event.method === "Runtime.exceptionThrown") {
      const d = event.params.exceptionDetails;
      errors.push(`未捕获异常: ${d.exception?.description ?? d.text}`);
    } else if (event.method === "Log.entryAdded") {
      const entry = event.params.entry;
      const text = `${entry.source}: ${entry.text}${entry.url ? ` (${entry.url})` : ""}`;
      if (entry.level === "error") errors.push(text);
      else if (entry.level === "warning") warnings.push(text);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chrome = findChrome();
  const profileDir = path.resolve(opts.profile);
  mkdirSync(profileDir, { recursive: true });

  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate,MediaRouter",
      `--remote-debugging-port=${opts.port}`,
      `--user-data-dir=${profileDir}`,
      opts.url,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromeStderr = "";
  child.stderr.on("data", (chunk) => {
    chromeStderr += chunk.toString();
  });

  const cleanup = () => {
    if (opts.keepOpen) return;
    child.kill("SIGKILL");
  };

  try {
    await waitFor(
      async () => {
        const res = await fetch(`http://127.0.0.1:${opts.port}/json/version`);
        return res.ok;
      },
      { timeout: opts.timeout, label: "启动浏览器" },
    );

    const target = await waitFor(
      async () => {
        const res = await fetch(`http://127.0.0.1:${opts.port}/json/list`);
        const list = await res.json();
        return list.find((t) => t.type === "page" && t.url.startsWith("http"));
      },
      { timeout: opts.timeout, label: "打开页面" },
    );

    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");

    // 等 document 加载完，再执行调用方给的表达式
    await waitFor(
      async () => {
        const { result } = await cdp.send("Runtime.evaluate", {
          expression: "document.readyState",
          returnByValue: true,
        });
        return result.value === "complete";
      },
      { timeout: opts.timeout, label: "页面加载完成" },
    );

    const expression =
      opts.eval ??
      `JSON.stringify({
         title: document.title,
         text: document.body.innerText.replace(/\\n{2,}/g, "\\n"),
         cookies: document.cookie,
       })`;

    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    // 给页面一点时间把异步的 console 输出吐完
    await sleep(300);
    const { errors, warnings } = collectProblems(cdp.events);

    if (exceptionDetails) {
      errors.push(`表达式抛错: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }

    const output = {
      url: target.url,
      value: result?.value ?? null,
      consoleErrors: errors,
      consoleWarnings: warnings,
    };
    console.log(JSON.stringify(output, null, 2));

    cdp.close();
    cleanup();
    process.exit(errors.length > 0 || exceptionDetails ? 1 : 0);
  } catch (error) {
    cleanup();
    console.error(`✗ ${error.message}`);
    if (process.env.DEBUG_CHROME) console.error(chromeStderr.slice(-2000));
    process.exit(1);
  }
}

main();
