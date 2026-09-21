const express = require("express");

const app = express();
const startedAt = Date.now();

const APP_NAME = process.env.APP_NAME || "jonathan-eks-lab";
const APP_VERSION = process.env.APP_VERSION || "1.0.0";
const GIT_SHA = process.env.GIT_SHA || "local";
const AWS_REGION = process.env.AWS_REGION || "unknown-region";
const POD_NAME = process.env.HOSTNAME || "local";
const NODE_NAME = process.env.NODE_NAME || "";
const PORT = Number(process.env.PORT || 3000);

function buildState() {
  return {
    app: APP_NAME,
    version: APP_VERSION,
    commit: GIT_SHA,
    region: AWS_REGION,
    pod: POD_NAME,
    node: NODE_NAME || undefined,
    uptime_s: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  };
}

app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.get("/api", (_req, res) => {
  res.json(buildState());
});

app.get("/", (req, res) => {
  const acceptsHtml = /(^|,\s*)text\/html(\s*;|,|$)/i.test(req.headers.accept || "");

  if (!acceptsHtml) {
    return res.json(buildState());
  }

  res.type("html").send(renderPage(buildState()));
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
  <style>
    :root {
      --paper: #f7f2e9;
      --ink: #132222;
      --muted: #465b5c;
      --line: #d2c7b8;
      --card: #fffdf8;
      --accent: #bf4f24;
      --accent-2: #0f7a75;
      --ok: #177f45;
      --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      --sans: "Aptos", "Segoe UI", Tahoma, sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      font-family: var(--serif);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.3)),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 31px,
          rgba(19,34,34,0.05) 31px,
          rgba(19,34,34,0.05) 32px
        ),
        var(--paper);
      min-height: 100vh;
    }

    .wrap {
      max-width: 1080px;
      margin: 0 auto;
      padding: 28px 18px 44px;
    }

    .mast {
      border: 2px solid var(--ink);
      background: var(--card);
      padding: 22px 20px 18px;
      box-shadow: 10px 10px 0 rgba(19,34,34,0.12);
    }

    .kicker {
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-2);
    }

    h1 {
      margin: 10px 0 8px;
      font-size: clamp(2rem, 6vw, 4rem);
      line-height: 1;
      letter-spacing: -0.03em;
      font-family: var(--sans);
    }

    .summary {
      margin: 0;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
      max-width: 62ch;
    }

    .live {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--ok);
      color: var(--ok);
      font-family: var(--mono);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: #edfff3;
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

    .panel {
      border: 1px solid var(--line);
      background: var(--card);
    }

    .panel h2 {
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      font-family: var(--sans);
      font-size: 0.98rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: #f3e9d9;
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
      background: #faf4e8;
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
      border: 1px dashed var(--line);
      padding: 10px;
      background: #fff;
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
      background: #fff5ef;
      padding: 10px 12px;
      font-size: 0.92rem;
      line-height: 1.5;
      color: #5a3a2e;
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
      <div class="live"><span class="dot"></span>estado en vivo</div>
    </section>

    <section class="board">
      <article class="panel">
        <h2>runtime snapshot</h2>
        <table>
          <tbody>
            <tr><th>app</th><td>${escapeHtml(state.app)}</td></tr>
            <tr><th>version</th><td>${escapeHtml(state.version)}</td></tr>
            <tr><th>commit</th><td>${escapeHtml(state.commit)}</td></tr>
            <tr><th>region</th><td>${escapeHtml(state.region)}</td></tr>
            <tr><th>pod</th><td>${escapeHtml(state.pod)}</td></tr>
            <tr><th>node</th><td>${escapeHtml(state.node || "not-set")}</td></tr>
            <tr><th>uptime</th><td>${escapeHtml(`${state.uptime_s}s`)}</td></tr>
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
        </div>
        <div class="note">
          Con <strong>curl</strong> sobre <strong>/</strong> recibes JSON. En navegador se renderiza esta vista.
        </div>
      </aside>
    </section>
  </main>
</body>
</html>`;
}
