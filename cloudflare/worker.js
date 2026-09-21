export default {
  async fetch(request) {
    const origin = "http://k8s-demo-web-4f6400c9ed-785076910.us-east-1.elb.amazonaws.com";
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, origin);

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incomingUrl.host);

    const proxiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "follow",
    });

    return fetch(proxiedRequest);
  },
};
