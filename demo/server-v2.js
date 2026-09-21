const express = require("express");

const app = express();
const startedAt = Date.now();

const APP_NAME = process.env.APP_NAME || "eks-deploy-lab";
const APP_VERSION = process.env.APP_VERSION || "1.1.0";
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

app.get("/healthz", (_req, res) => res.status(200).type("text/plain").send("ok"));
app.get("/api", (_req, res) => res.json(buildState()));
app.get("/", (req, res) => {
  const acceptsHtml = /(^|,\s*)text\/html(\s*;|,|$)/i.test(req.headers.accept || "");
  if (!acceptsHtml) return res.json(buildState());
  res.type("html").send(`<html><body><pre>${JSON.stringify(buildState(), null, 2)}</pre></body></html>`);
});

app.listen(PORT, () => console.log(`listening on :${PORT}`));
