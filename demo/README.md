# Demo material

Estos archivos sirven para mostrar dos cambios de la app durante la practica.

## Escenarios

- [server-v2.js](server-v2.js): version nueva para un rollout normal.
- [server-broken-health.js](server-broken-health.js): rompe `/healthz` para probar rollback o fallo controlado.

## Flujo sugerido

```bash
cp demo/server-v2.js server.js
docker build --build-arg APP_VERSION=1.1.0 --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t demo:v2 .
cp demo/server-broken-health.js server.js
docker build -t demo:broken .
```

Antes de volver al estado estable, revisa el diff:

```bash
git diff --stat
git diff server.js
```
