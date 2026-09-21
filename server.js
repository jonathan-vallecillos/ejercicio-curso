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
  const chips = [
    ["Version", state.version],
    ["Commit", state.commit],
    ["Region", state.region],
    ["Pod", state.pod],
    ["Node", state.node || "not-set"],
    ["Uptime", `${state.uptime_s}s`],
  ];

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(state.app)} | EKS deployment lab</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #08111f;
      --bg-2: #0f1c31;
      --panel: rgba(255, 255, 255, 0.08);
      --panel-border: rgba(255, 255, 255, 0.14);
      --text: #eef4ff;
      --muted: #b4c2df;
      --accent: #6ee7ff;
      --accent-2: #8b5cf6;
      --success: #34d399;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(110, 231, 255, 0.16), transparent 34%),
        radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.20), transparent 28%),
        linear-gradient(160deg, var(--bg), var(--bg-2));
    }

    .wrap {
      max-width: 1160px;
      margin: 0 auto;
      padding: 40px 24px 32px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 28px;
      align-items: stretch;
      margin-top: 10px;
    }

    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
    }

    .headline {
      padding: 34px;
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
      border: 1px solid var(--panel-border);
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .headline::after {
      content: "";
      position: absolute;
      inset: auto -10% -30% auto;
      width: 240px;
      height: 240px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(110, 231, 255, 0.22), transparent 62%);
      pointer-events: none;
    }

    .eyebrow {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
    }

    h1 {
      font-size: clamp(2.5rem, 7vw, 4.9rem);
      line-height: 0.96;
      margin: 22px 0 18px;
      max-width: 10ch;
      letter-spacing: -0.05em;
    }

    .lede {
      margin: 0;
      max-width: 56ch;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.7;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 28px;
    }

    @media (max-width: 620px) {
      .stats { grid-template-columns: 1fr; }
    }

    .stat,
    .panel {
      border-radius: 22px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: var(--shadow);
    }

    .stat {
      padding: 18px 18px 16px;
    }

    .stat span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .stat strong {
      display: block;
      margin-top: 9px;
      font-size: 1.1rem;
      word-break: break-word;
    }

    .panel {
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .panel h2 {
      margin: 0;
      font-size: 1.2rem;
      letter-spacing: -0.02em;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(52, 211, 153, 0.12);
      color: #baf7dd;
      border: 1px solid rgba(52, 211, 153, 0.24);
      font-size: 13px;
      font-weight: 700;
    }

    .badge i {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--success);
      box-shadow: 0 0 0 6px rgba(52, 211, 153, 0.16);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .chip {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(8, 17, 31, 0.45);
      border: 1px solid rgba(255,255,255,0.1);
    }

    .chip span {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .chip strong {
      font-size: 0.98rem;
      word-break: break-word;
    }

    .footer {
      margin-top: 24px;
      color: var(--muted);
      font-size: 0.95rem;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.95em;
      color: var(--accent);
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <article class="headline">
        <div class="eyebrow">AWS EKS + ALB + GitHub Actions</div>
        <h1>${escapeHtml(state.app)}</h1>
        <p class="lede">
          This service is designed to deploy through ECR and EKS, expose itself with an ALB Ingress, and show the runtime metadata coming from the running pod.
        </p>

        <div class="stats">
          <div class="stat"><span>Version</span><strong>${escapeHtml(state.version)}</strong></div>
          <div class="stat"><span>Commit</span><strong>${escapeHtml(state.commit)}</strong></div>
          <div class="stat"><span>Uptime</span><strong>${escapeHtml(state.uptime_s)} s</strong></div>
        </div>
      </article>

      <aside class="panel">
        <div class="badge"><i></i> Health path is green</div>
        <h2>Runtime details</h2>
        <div class="grid">
          ${chips
            .map(
              ([label, value]) => `
                <div class="chip">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="footer">
          JSON is returned for <code>curl</code>, while a browser gets this page.
        </div>
      </aside>
    </section>
  </main>
</body>
</html>`;
}
