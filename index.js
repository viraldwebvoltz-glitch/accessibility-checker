const express = require("express");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const dns = require("dns").promises;
const net = require("net");
const puppeteer = require("puppeteer");
const axeSource = require("axe-core").source;
const { buildHtmlReport } = require("./reportTemplate");
const { attachNetworkCapture } = require("./networkCapture");
const { customChecks, customRules, CUSTOM_RULE_IDS } = require("./customAxeRules");

const app = express();
const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(__dirname, "reports");
const MAX_CRAWL_PAGES = 20;

let browser;

function getChromeExecutablePath() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  return candidates.find((candidate) => Boolean(candidate) && fs.existsSync(candidate));
}

// ---------- SSRF protection ----------
async function isUrlSafe(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (
      net.isIP(address) &&
      (address.startsWith("127.") ||
        address.startsWith("10.") ||
        address.startsWith("192.168.") ||
        address.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
        address === "::1")
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

// ---------- URL normalisation ----------
function isLocaleUrl(rawUrl) {
  try {
    const { pathname } = new URL(rawUrl);
    return /^\/[a-z]{2}(\/|$)/i.test(pathname);
  } catch {
    return false;
  }
}

function normalizePageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    let str = u.toString();
    if (u.pathname.length > 1 && str.endsWith("/")) str = str.slice(0, -1);
    return str;
  } catch {
    return rawUrl;
  }
}

// ---------- Cleanup job ----------
function cleanupOldReports() {
  if (!fs.existsSync(REPORTS_DIR)) return;

  const maxAgeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const file of fs.readdirSync(REPORTS_DIR)) {
    const filePath = path.join(REPORTS_DIR, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
    }
  }
}

// ---------- Page auditor ----------
// Opens a page, runs axe + custom rules, optionally collects same-origin links.
// Returns { pageResult, finalUrl, links } or null on failure.
async function auditPage(url, serializedChecks, collectLinks = false) {
  let page;
  let netCapture;
  const consoleLogs = [];

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    netCapture = await attachNetworkCapture(page);

    page.on("console", (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    });
    page.on("pageerror", (err) => {
      consoleLogs.push({ type: "pageerror", text: err.message, location: null });
    });

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: ["domcontentloaded", "networkidle2"],
        timeout: 60000,
      });
    } catch (navError) {
      console.warn(`Skipping ${url}: ${navError.message}`);
      return null;
    }

    const finalUrl = page.url();
    if (!response || finalUrl === "about:blank") return null;
    if (!response.ok() && response.status() >= 400) return null;

    await page.evaluate(axeSource);

    await page.evaluate(
      (checks, rules) => {
        const reconstructedChecks = checks.map((check) => ({
          ...check,
          // eslint-disable-next-line no-new-func
          evaluate: new Function("return (" + check.evaluate + ").apply(this, arguments);"),
        }));
        axe.configure({ checks: reconstructedChecks, rules });
      },
      serializedChecks,
      customRules
    );

    const results = await page.evaluate(async () => axe.run());
    const networkRecords = netCapture.getRecords();
    const networkSummary = netCapture.getSummary(networkRecords);

    let links = [];
    if (collectLinks) {
      // Use the actual post-redirect origin so http→https redirects don't drop links.
      const actualOrigin = new URL(finalUrl).origin;
      links = await page.evaluate((origin) => {
        const hrefs = new Set();
        document.querySelectorAll("a[href]").forEach((a) => {
          try {
            const u = new URL(a.href);
            if (u.origin === origin && !a.href.includes("#")) hrefs.add(u.toString());
          } catch {}
        });
        document.querySelectorAll("form[action]").forEach((f) => {
          if (!f.method || f.method.toLowerCase() === "get") {
            try {
              const u = new URL(f.action);
              if (u.origin === origin) hrefs.add(u.toString());
            } catch {}
          }
        });
        return Array.from(hrefs);
      }, actualOrigin);
    }

    return {
      pageResult: {
        url,
        finalUrl,
        accessibility: results,
        network: { summary: networkSummary, requests: networkRecords },
        console: consoleLogs,
      },
      finalUrl,
      links,
    };
  } catch (pageError) {
    console.warn(`Error on ${url}: ${pageError.message}`);
    return null;
  } finally {
    if (netCapture) await netCapture.detach();
    if (page) await page.close();
  }
}

// ---------- Routes ----------
// Accepts one or more URLs via repeated query params: ?url=url1&url=url2
// Multiple URLs → audit each directly, no subpage crawling, single combined report.
// Single URL  → crawl subpages up to maxPages, single combined report.
app.get("/audit", async (req, res) => {
  const rawUrl = req.query.url;
  const maxPages = Math.min(Math.max(parseInt(req.query.maxPages) || MAX_CRAWL_PAGES, 1), 50);

  if (!rawUrl) {
    return res.status(400).json({ success: false, message: "Please provide a URL" });
  }

  const urls = Array.isArray(rawUrl) ? rawUrl : [rawUrl];

  console.log(`Received audit request for ${urls.length} URL(s):`, urls);

  const multiMode = urls.length > 1;

  for (const u of urls) {
    if (!(await isUrlSafe(u))) {
      return res.status(400).json({ success: false, message: `Invalid or unsafe URL: ${u}` });
    }
  }

  const serializedChecks = customChecks.map((check) => ({
    ...check,
    evaluate: check.evaluate.toString(),
  }));

  const pageResults = [];

  try {
    if (multiMode) {
      // Audit each provided URL directly — no subpage crawling
      for (const url of urls) {
        const result = await auditPage(url, serializedChecks);
        if (result) pageResults.push(result.pageResult);
      }
    } else {
      // Single URL mode: collect links from homepage and crawl subpages
      const url = urls[0];
      const visited = new Set();
      const queue = [url];

      while (queue.length > 0 && pageResults.length < maxPages) {
        const currentUrl = queue.shift();
        const normalizedUrl = normalizePageUrl(currentUrl);

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        // Collect links only from the first successfully audited page
        const isFirstPage = pageResults.length === 0;
        const result = await auditPage(currentUrl, serializedChecks, isFirstPage);
        if (!result) continue;

        if (isFirstPage) {
          for (const link of result.links) {
            if (isLocaleUrl(link)) continue;
            const norm = normalizePageUrl(link);
            if (!visited.has(norm) && !queue.some((q) => normalizePageUrl(q) === norm)) {
              queue.push(link);
            }
          }
        }

        pageResults.push(result.pageResult);
      }
    }

    if (pageResults.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Failed to load the provided URL(s). The site may be blocking automated browsers or redirecting unexpectedly.",
      });
    }

    fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const timestamp = Date.now();
    let reportName;
    if (multiMode) {
      const domains = [
        ...new Set(
          urls.map((u) => {
            try {
              return new URL(u).hostname.replace(/^www\./, "");
            } catch {
              return "unknown";
            }
          })
        ),
      ];
      reportName =
        domains.length <= 2
          ? domains.join("+")
          : `${domains[0]}+${domains.length - 1}more`;
    } else {
      reportName = new URL(urls[0]).hostname.replace(/^www\./, "");
    }

    const jsonFilename = `${reportName}.json`;
    const htmlFilename = `${reportName}.html`;

    const combinedReport = {
      requestedUrl: multiMode ? urls : urls[0],
      timestamp,
      pages: pageResults,
    };

    fs.writeFileSync(
      path.join(REPORTS_DIR, jsonFilename),
      JSON.stringify(combinedReport, null, 2)
    );

    const html = buildHtmlReport(combinedReport, CUSTOM_RULE_IDS);
    fs.writeFileSync(path.join(REPORTS_DIR, htmlFilename), html);

    const totalViolations = pageResults.reduce((sum, p) => sum + (p.accessibility.violations || []).length, 0);
    const totalPasses    = pageResults.reduce((sum, p) => sum + (p.accessibility.passes    || []).length, 0);
    const customRuleIdSet = new Set(customRules.map((r) => r.id));
    const totalCustom = pageResults.reduce(
      (sum, p) => sum + (p.accessibility.violations || []).filter((v) => customRuleIdSet.has(v.id)).length,
      0
    );

    res.json({
      success: true,
      pagesScanned: pageResults.length,
      violations: totalViolations,
      customRuleViolations: totalCustom,
      passes: totalPasses,
      report: `/reports/${htmlFilename}`,
      reportJson: `/reports/${jsonFilename}`,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/reports", express.static(REPORTS_DIR));

// ---------- Startup / shutdown ----------
async function start() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const chromeExecutablePath = getChromeExecutablePath();

  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromeExecutablePath,
    ignoreHTTPSErrors: true,
    args: [
      "--headless=new",
      "--window-position=-32000,-32000",
      "--window-size=1280,800",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--no-zygote",
      "--renderer-process-limit=1",
      "--js-flags=--max-old-space-size=512",
      "--disk-cache-size=0",
      "--media-cache-size=0",
      "--force-color-profile=srgb",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-client-side-phishing-detection",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-domain-reliability",
      "--disable-extensions",
      "--disable-features=AudioServiceOutOfProcess,TranslateUI,Translate",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-notifications",
      "--disable-popup-blocking",
      "--disable-print-preview",
      "--disable-renderer-backgrounding",
      "--disable-speech-api",
      "--disable-sync",
      "--disable-translate",
      "--disable-webgl",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-first-run",
      "--no-pings",
      "--password-store=basic",
      "--use-mock-keychain",
      "--safebrowsing-disable-auto-update",
      "--log-level=3",
    ],
  });

  setInterval(cleanupOldReports, 60 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`Audit server listening on port ${PORT}`);
  });
}

async function shutdown() {
  console.log("Shutting down...");
  if (browser) await browser.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
