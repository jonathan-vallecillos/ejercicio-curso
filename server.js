const express = require("express");

const app = express();
const startedAt = Date.now();

const APP_NAME = process.env.APP_NAME || "jonathan-eks-lab";
const APP_VERSION = process.env.APP_VERSION || "1.0.0";
const GIT_SHA = process.env.GIT_SHA || "local";
const AWS_REGION = process.env.AWS_REGION || "unknown-region";
const CLUSTER_NAME = process.env.CLUSTER_NAME || "unknown-cluster";
const NAMESPACE = process.env.NAMESPACE || "demo";
const BUILD_DATE = process.env.BUILD_DATE || "unknown";
const REPO_URL = process.env.REPO_URL || "https://github.com/jonathan-vallecillos/ejercicio-curso";
const README_URL = process.env.README_URL || "https://github.com/jonathan-vallecillos/ejercicio-curso/blob/main/README.md";
const POD_NAME = process.env.HOSTNAME || "local";
const NODE_NAME = process.env.NODE_NAME || "";
const PORT = Number(process.env.PORT || 3000);

function toRawGithubReadmeUrl(url) {
  if (!url) return "";
  return String(url)
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");
}

function normalizeIp(value) {
  if (!value) return undefined;
  return String(value).split(",")[0].trim() || undefined;
}

function shortCommit(sha) {
  if (!sha || sha === "local") return sha;
  return String(sha).slice(0, 12);
}

function buildState(req) {
  const now = Date.now();
  const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  const acceptsHtml = /(^|,\s*)text\/html(\s*;|,|$)/i.test(req?.headers?.accept || "");

  return {
    app: APP_NAME,
    version: APP_VERSION,
    commit: GIT_SHA,
    commit_short: shortCommit(GIT_SHA),
    region: AWS_REGION,
    cluster: CLUSTER_NAME,
    namespace: NAMESPACE,
    build_date: BUILD_DATE,
    pod: POD_NAME,
    node: NODE_NAME || undefined,
    uptime_s: Math.max(0, Math.floor((now - startedAt) / 1000)),
    started_at: new Date(startedAt).toISOString(),
    now: new Date(now).toISOString(),
    process: {
      pid: process.pid,
      node_version: process.version,
      memory_rss_mb: rssMb,
      port: PORT,
    },
    request: {
      method: req?.method,
      path: req?.path,
      host: req?.headers?.host,
      forwarded_proto: req?.headers?.["x-forwarded-proto"],
      forwarded_for: normalizeIp(req?.headers?.["x-forwarded-for"]),
      accepts_html: acceptsHtml,
    },
    links: {
      repo: REPO_URL,
      readme: README_URL,
      readme_raw: toRawGithubReadmeUrl(README_URL),
    },
  };
}

app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.get("/api", (_req, res) => {
  res.json(buildState(_req));
});

app.get("/readme/raw", async (_req, res) => {
  try {
    const response = await fetch(toRawGithubReadmeUrl(README_URL), {
      headers: { "User-Agent": "eks-curso-readme-proxy" },
    });

    if (!response.ok) {
      res.status(502).type("text/plain; charset=utf-8").send("No se pudo leer el README remoto de GitHub.");
      return;
    }

    const markdown = await response.text();
    res.type("text/plain; charset=utf-8").send(markdown);
  } catch (_error) {
    res.status(500).type("text/plain; charset=utf-8").send("No se pudo leer el README remoto de GitHub.");
  }
});

app.get("/", (req, res) => {
  const acceptsHtml = /(^|,\s*)text\/html(\s*;|,|$)/i.test(req.headers.accept || "");

  if (!acceptsHtml) {
    return res.json(buildState(req));
  }

  res.type("html").send(renderPage(buildState(req)));
});

app.listen(PORT, () => {
  console.log(`listening on :${PORT}`);
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"]|'/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

function renderPage(state) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(state.app)} | runtime board</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown.min.css">
  <style>
    :root {
      --bg: #f4f7fb;
      --ink: #142033;
      --muted: #4e6281;
      --line: #d4dfef;
      --card: #ffffff;
      --accent: #f97316;
      --accent-2: #0e7490;
      --ok: #15803d;
      --chip: #f0f5ff;
      --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --serif: "Constantia", "Times New Roman", serif;
      --sans: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      font-family: var(--sans);
      background:
        radial-gradient(circle at 12% 8%, rgba(14, 116, 144, 0.16), transparent 38%),
        radial-gradient(circle at 90% 0%, rgba(249, 115, 22, 0.14), transparent 32%),
        linear-gradient(180deg, #ffffff 0%, var(--bg) 72%);
      min-height: 100vh;
    }

    .wrap {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 18px 44px;
    }

    .mast {
      border: 1px solid var(--line);
      background: var(--card);
      padding: 26px 24px 20px;
      border-radius: 18px;
      box-shadow: 0 18px 45px rgba(20, 32, 51, 0.08);
    }

    .kicker {
      margin: 0;
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-2);
    }

    h1 {
      margin: 10px 0 8px;
      font-size: clamp(2rem, 5.4vw, 3.6rem);
      line-height: 1.02;
      letter-spacing: -0.03em;
      font-family: var(--sans);
      color: #0f172a;
    }

    .summary {
      margin: 0;
      color: var(--muted);
      font-size: 1.02rem;
      line-height: 1.7;
      max-width: 62ch;
    }

    .quick-links {
      margin-top: 14px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .quick-links a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      font-family: var(--mono);
      font-size: 12px;
      color: #0b3d55;
      background: #e8f6ff;
      border: 1px solid #b8dcef;
      border-radius: 999px;
      padding: 6px 10px;
    }

    .quick-links a:hover {
      background: #d7efff;
    }

    .live {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 13px;
      border: 1px solid var(--ok);
      color: var(--ok);
      font-family: var(--mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-radius: 999px;
      background: #ecfdf3;
    }

    .tabs {
      margin-top: 16px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tab-btn {
      border: 1px solid var(--line);
      background: #fff;
      color: #174e6a;
      border-radius: 999px;
      padding: 7px 12px;
      font-family: var(--mono);
      font-size: 12px;
      cursor: pointer;
    }

    .tab-btn.active {
      background: #dff1ff;
      border-color: #9ec8e5;
      color: #0a3e58;
    }

    .tab-panel {
      display: block;
    }

    .tab-panel.hidden {
      display: none;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--ok);
      animation: blink 1.8s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }

    .board {
      margin-top: 22px;
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
    }

    @media (max-width: 920px) {
      .board { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      .wrap {
        padding: 16px 12px 24px;
      }

      .mast {
        padding: 18px 14px 14px;
      }

      h1 {
        font-size: clamp(1.65rem, 8vw, 2.1rem);
      }

      .summary {
        font-size: 0.95rem;
      }

      .quick-links,
      .tabs {
        gap: 6px;
      }

      .quick-links a,
      .tab-btn {
        width: 100%;
        justify-content: center;
      }

      table,
      tbody,
      tr,
      th,
      td {
        display: block;
        width: 100%;
      }

      tr {
        border-bottom: 1px solid var(--line);
      }

      th {
        border-bottom: none;
        padding-bottom: 4px;
      }

      td {
        padding-top: 0;
        padding-bottom: 10px;
      }

      .readme-body {
        max-height: 58vh;
        padding: 12px;
      }
    }

    .panel {
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(20, 32, 51, 0.05);
    }

    .panel h2 {
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      font-family: var(--sans);
      font-size: 0.98rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: linear-gradient(90deg, #eef6ff, #f8fbff);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }

    th {
      width: 36%;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: var(--chip);
    }

    td {
      font-family: var(--mono);
      font-size: 13px;
      word-break: break-word;
    }

    .meter {
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .metric {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px;
      background: var(--chip);
    }

    .metric b {
      display: block;
      margin-bottom: 3px;
      font-family: var(--sans);
      font-size: 0.9rem;
    }

    .metric span {
      font-family: var(--mono);
      color: var(--accent);
      font-size: 0.95rem;
    }

    .note {
      margin-top: 14px;
      border-left: 4px solid var(--accent);
      background: #fff8f2;
      padding: 10px 12px;
      font-size: 0.92rem;
      line-height: 1.5;
      color: #5a3a2e;
      border-bottom-left-radius: 10px;
      border-top-left-radius: 10px;
    }

    .readme-wrap {
      margin-top: 22px;
    }

    .readme-body {
      margin: 0;
      max-height: 66vh;
      overflow: auto;
      padding: 18px;
      background: #f8fbff;
      color: #1b2a44;
    }

    .readme-body.markdown-body {
      font-family: var(--sans);
      font-size: 14px;
      line-height: 1.65;
      background: #f8fbff;
    }

    .readme-body.markdown-body pre,
    .readme-body.markdown-body code {
      font-family: var(--mono);
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="mast">
      <p class="kicker">journal / deploy report / live pod</p>
      <h1>${escapeHtml(state.app)}</h1>
      <p class="summary">
        Este tablero muestra la telemetria real del contenedor que respondio la solicitud. Si cambias de pod durante el balanceo, los datos cambian en la siguiente peticion.
      </p>
      <div class="quick-links">
        <a href="${escapeHtml(state.links.repo)}" target="_blank" rel="noopener noreferrer">ver repo</a>
      </div>
      <div class="tabs">
        <button id="tab-runtime" class="tab-btn active" type="button">runtime</button>
        <button id="tab-readme" class="tab-btn" type="button">readme github</button>
      </div>
      <div class="live"><span class="dot"></span>estado en vivo</div>
    </section>

    <section id="panel-runtime" class="board tab-panel">
      <article class="panel">
        <h2>runtime snapshot</h2>
        <table>
          <tbody>
            <tr><th>app</th><td>${escapeHtml(state.app)}</td></tr>
            <tr><th>version</th><td>${escapeHtml(state.version)}</td></tr>
            <tr><th>commit</th><td>${escapeHtml(state.commit_short || state.commit)}</td></tr>
            <tr><th>region</th><td>${escapeHtml(state.region)}</td></tr>
            <tr><th>cluster</th><td>${escapeHtml(state.cluster)}</td></tr>
            <tr><th>namespace</th><td>${escapeHtml(state.namespace)}</td></tr>
            <tr><th>pod</th><td>${escapeHtml(state.pod)}</td></tr>
            <tr><th>node</th><td>${escapeHtml(state.node || "not-set")}</td></tr>
            <tr><th>uptime</th><td>${escapeHtml(`${state.uptime_s}s`)}</td></tr>
            <tr><th>memory</th><td>${escapeHtml(`${state.process.memory_rss_mb} MB`)}</td></tr>
            <tr><th>node.js</th><td>${escapeHtml(state.process.node_version)}</td></tr>
            <tr><th>pid</th><td>${escapeHtml(String(state.process.pid))}</td></tr>
            <tr><th>build date</th><td>${escapeHtml(state.build_date)}</td></tr>
            <tr><th>started at</th><td>${escapeHtml(state.started_at)}</td></tr>
            <tr><th>now</th><td>${escapeHtml(state.now)}</td></tr>
          </tbody>
        </table>
      </article>

      <aside class="panel">
        <h2>checks</h2>
        <div class="meter">
          <div class="metric">
            <b>health endpoint</b>
            <span>/healthz -> ok</span>
          </div>
          <div class="metric">
            <b>api endpoint</b>
            <span>/api -> json</span>
          </div>
          <div class="metric">
            <b>home endpoint</b>
            <span>/ -> html/json</span>
          </div>
          <div class="metric">
            <b>request host</b>
            <span>${escapeHtml(state.request.host || "unknown")}</span>
          </div>
          <div class="metric">
            <b>forwarded proto</b>
            <span>${escapeHtml(state.request.forwarded_proto || "unknown")}</span>
          </div>
          <div class="metric">
            <b>client ip</b>
            <span>${escapeHtml(state.request.forwarded_for || "unknown")}</span>
          </div>
          <div class="metric">
            <b>render mode</b>
            <span>${escapeHtml(state.request.accepts_html ? "html" : "json")}</span>
          </div>
        </div>
        <div class="note">
          Con <strong>curl</strong> sobre <strong>/</strong> recibes JSON. En navegador se renderiza esta vista.
        </div>
      </aside>
    </section>

    <section id="panel-readme" class="readme-wrap tab-panel hidden">
      <article class="panel">
        <h2>readme del proyecto (desde github)</h2>
        <article id="readme-content" class="readme-body markdown-body">Cargando README desde GitHub...</article>
      </article>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js"></script>
  <script>
    (function () {
      const runtimeButton = document.getElementById("tab-runtime");
      const readmeButton = document.getElementById("tab-readme");
      const runtimePanel = document.getElementById("panel-runtime");
      const readmePanel = document.getElementById("panel-readme");
      const readmeContent = document.getElementById("readme-content");
      let readmeLoaded = false;

      function setActiveTab(name) {
        const readmeActive = name === "readme";
        runtimeButton.classList.toggle("active", !readmeActive);
        readmeButton.classList.toggle("active", readmeActive);
        runtimePanel.classList.toggle("hidden", readmeActive);
        readmePanel.classList.toggle("hidden", !readmeActive);
      }

      async function loadReadmeIfNeeded() {
        if (readmeLoaded) return;
        try {
          const response = await fetch("/readme/raw", { headers: { Accept: "text/plain" } });
          if (!response.ok) {
            readmeContent.textContent = "No se pudo cargar el README desde GitHub.";
            return;
          }
          const markdown = await response.text();
          if (window.showdown && typeof window.showdown.Converter === "function") {
            const converter = new window.showdown.Converter({
              ghCompatibleHeaderId: true,
              tables: true,
              tasklists: true,
              simpleLineBreaks: true,
              strikethrough: true,
            });
            readmeContent.innerHTML = converter.makeHtml(markdown);
          } else {
            readmeContent.textContent = markdown;
          }
          readmeLoaded = true;
        } catch (_error) {
          readmeContent.textContent = "No se pudo cargar el README desde GitHub.";
        }
      }

      runtimeButton.addEventListener("click", () => {
        setActiveTab("runtime");
      });

      readmeButton.addEventListener("click", async () => {
        setActiveTab("readme");
        await loadReadmeIfNeeded();
      });
    })();
  </script>
</body>
</html>`;
}
