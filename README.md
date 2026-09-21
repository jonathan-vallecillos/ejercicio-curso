# Guia real del despliegue EKS (cuenta personal)

Este repositorio documenta, paso a paso, como se levanto una app Node.js en Amazon EKS usando ECR, Kubernetes e Ingress con AWS Load Balancer Controller.

No es plantilla generica: es la bitacora real del despliegue hecho en esta practica, con decisiones, cambios y comandos aplicados.

## Resultado final

- Repositorio GitHub: https://github.com/jonathan-vallecillos/ejercicio-curso
- Cluster EKS: `jonathan-eks-lab` en `us-east-1`
- Repositorio ECR: `ejercicio-curso-app`
- Namespace de app: `demo`
- URL del servicio: `http://k8s-demo-web-4f6400c9ed-785076910.us-east-1.elb.amazonaws.com`

## Arquitectura usada

1. App Node.js con Express en [server.js](server.js), con rutas:
   - `/healthz`
   - `/api`
   - `/` con respuesta HTML o JSON segun `Accept`
2. Imagen Docker en [Dockerfile](Dockerfile).
3. Publicacion de imagen en ECR.
4. Despliegue Kubernetes con:
   - [k8s/namespace.yaml](k8s/namespace.yaml)
   - [k8s/deployment.yaml](k8s/deployment.yaml)
   - [k8s/service.yaml](k8s/service.yaml)
   - [k8s/ingress.yaml](k8s/ingress.yaml)
5. Exposicion publica con ALB (Ingress class `alb`).
6. Pipeline CI/CD en [.github/workflows/deploy.yml](.github/workflows/deploy.yml) con OIDC.

## Cambios concretos que se hicieron

1. Se reemplazaron nombres del ejemplo por valores propios:
   - app: `jonathan-eks-lab`
   - cluster: `jonathan-eks-lab`
   - ECR repo: `ejercicio-curso-app`
2. Se actualizaron ARNs y trust policy para el repo real en:
   - [iam/trust-policy.json](iam/trust-policy.json)
   - [iam/deploy-policy.json](iam/deploy-policy.json)
3. Se subio la imagen bootstrap a ECR y se dejo referenciada en [k8s/deployment.yaml](k8s/deployment.yaml).
4. Se instalo AWS Load Balancer Controller con IRSA.
5. Se corrigio un crash del controller agregando `vpcId` explicito en Helm (no dependio de IMDS).
6. Se publico el Ingress y se confirmo target healthy en ALB.

## Paso a paso (lo que se ejecuto)

## 1) Preparar herramientas y credenciales

```bash
aws sts get-caller-identity
docker version
kubectl version --client
eksctl version
```

## 2) Crear ECR y publicar imagen inicial

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=580446611735
export ECR_REPO=ejercicio-curso-app
export REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

aws ecr create-repository \
  --repository-name $ECR_REPO \
  --image-scanning-configuration scanOnPush=true \
  --region $AWS_REGION

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $REGISTRY

docker build \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg GIT_SHA=bootstrap \
  -t $REGISTRY/$ECR_REPO:bootstrap .

docker push $REGISTRY/$ECR_REPO:bootstrap
```

## 3) Crear cluster EKS

El archivo usado fue [cluster.yaml](cluster.yaml), ya parametrizado para `jonathan-eks-lab` y `us-east-1`.

```bash
eksctl create cluster -f cluster.yaml
```

Nota: por un tema de DNS local con el binario de eksctl en Windows, se ejecuto eksctl via contenedor Docker para crear cluster y nodegroup.

## 4) Configurar OIDC y rol para GitHub Actions

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

aws iam create-role \
  --role-name GitHubOIDCDeployRole \
  --assume-role-policy-document file://iam/trust-policy.json

aws iam put-role-policy \
  --role-name GitHubOIDCDeployRole \
  --policy-name deploy \
  --policy-document file://iam/deploy-policy.json
```

Valor a guardar en secret de GitHub (`AWS_DEPLOY_ROLE_ARN`):

`arn:aws:iam::580446611735:role/GitHubOIDCDeployRole`

## 5) Instalar AWS Load Balancer Controller

1. Crear policy local con [alb-iam-policy.json](alb-iam-policy.json).
2. Crear service account con IRSA.
3. Instalar chart con Helm.

Comando Helm final aplicado (el importante fue `vpcId`):

```bash
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=jonathan-eks-lab \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=us-east-1 \
  --set vpcId=<VPC_ID_DEL_CLUSTER> \
  --set replicaCount=1
```

## 6) Desplegar app en Kubernetes

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

kubectl -n demo rollout status deployment/web
kubectl -n demo get pods -o wide
kubectl -n demo get ingress web -o wide
```

## 7) Validacion

Checks aplicados:

1. Pod web en `Running`.
2. Ingress reconciliado por ALB Controller.
3. ALB en estado `active` por `aws elbv2 describe-load-balancers`.
4. Target group en `healthy` por `aws elbv2 describe-target-health`.

## URL del servicio

`http://k8s-demo-web-4f6400c9ed-785076910.us-east-1.elb.amazonaws.com`

Si en red corporativa no resuelve DNS, probar desde red externa (hotspot, red residencial, etc.).

## Como manejo cambios y redeploy (mi flujo real)

Cuando hago un cambio (por ejemplo en UI o en la API), sigo este flujo:

1. Hago el cambio en codigo, normalmente en [server.js](server.js) o en manifiestos de [k8s/deployment.yaml](k8s/deployment.yaml).
2. Lo valido localmente con `npm start` y pruebas simples a `/healthz`, `/api` y `/`.
3. Hago commit y push a `main`.
4. Se dispara el workflow de [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
5. El pipeline construye imagen nueva, la sube a ECR y actualiza el Deployment en EKS.
6. Kubernetes hace rollout gradualmente; cuando el pod nuevo esta sano, queda activo y termina el reemplazo.

Lo importante para mi es que no tengo que bajar el servicio completo para publicar cambios. EKS reemplaza pods y ALB sigue enrutando trafico al pod saludable.

## Como se reflejan los cambios en la URL publica

En la URL publica del ALB, los cambios se ven cuando termina el rollout.

Tambien se ven reflejados en runtime los metadatos:

1. `commit`: cambia al SHA de la imagen desplegada.
2. `version`: cambia segun los build args/env de la imagen.
3. `pod`: cambia cuando responde otro pod (o cuando se renueva el pod en rollout).
4. `node`: muestra el nodo donde corre el pod.
5. `uptime_s`: se reinicia en pods nuevos y vuelve a crecer.

Si quiero comprobar que de verdad se aplico el deploy, reviso:

1. `kubectl -n demo rollout status deployment/web`
2. `kubectl -n demo get pods -o wide`
3. la URL publica y el bloque `runtime snapshot`.

## CI/CD (GitHub Actions)

El workflow esta en [.github/workflows/deploy.yml](.github/workflows/deploy.yml) y es el que automatiza todo el despliegue.

Pasos que ejecuta:

1. Asume rol AWS via OIDC.
2. Build y push de imagen con tag SHA.
3. `kubectl apply` de manifiestos base.
4. Update de imagen en Deployment.
5. Rollout status y rollback automatico si falla.

Si falla el paso de credenciales (OIDC/rol), no se genera imagen nueva y por eso la URL publica sigue mostrando la version anterior. En ese caso reviso trust policy del rol y permisos de GitHub Actions.

## Incidencia real que me paso y como la atiendo

En esta practica, varios runs fallaron en el paso `Configure AWS credentials`.

Lo que significa en la practica:

1. El pipeline ni siquiera llega al build de Docker.
2. No se sube imagen nueva a ECR.
3. El Deployment sigue con la ultima imagen valida (`bootstrap` en este caso).
4. La URL publica sigue viva, pero sin los cambios nuevos.

### Checklist que sigo cuando pasa este error

1. Ver exactamente el paso que fallo en Actions.
2. Validar el provider OIDC en AWS.
3. Validar trust policy del rol.
4. Confirmar que el workflow tiene `permissions.id-token: write`.
5. Reintentar con push nuevo despues de corregir trust policy.

Comandos utiles que dejo listos:

```bash
# 1) Ver estado de runs
curl -s https://api.github.com/repos/jonathan-vallecillos/ejercicio-curso/actions/runs?per_page=5

# 2) Ver pasos del job para ubicar falla exacta
curl -s https://api.github.com/repos/jonathan-vallecillos/ejercicio-curso/actions/runs/<RUN_ID>/jobs

# 3) Validar provider OIDC
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::580446611735:oidc-provider/token.actions.githubusercontent.com

# 4) Validar trust policy vigente del rol
aws iam get-role --role-name GitHubOIDCDeployRole
```

### Ajuste que aplique para estabilizar

Para evitar bloqueos por variaciones de `sub` entre eventos/refs de GitHub, deje el trust policy del repo en modo:

`repo:jonathan-vallecillos/ejercicio-curso:*`

Eso mantiene el alcance en este repo (no abre a otros repositorios) y me evita fallas por formato de subject.

Cuando el pipeline ya este estable, puedo endurecerlo de nuevo a una rama puntual si lo necesito.

## Si quiero forzar redeploy manual cuando CI/CD falla

Si el workflow sigue fallando y necesito publicar urgente, tengo dos opciones:

1. Build/push local (si Docker daemon esta disponible) y luego `kubectl set image`.
2. Corregir OIDC primero y repetir push para que quede todo trazado por pipeline.

Yo prefiero la opcion 2 para mantener auditoria limpia por commit en Actions.

## Ventajas que estoy aprovechando con Kubernetes + AWS

Esto es lo que mas me aporta en esta practica:

1. Despliegue continuo sin bajar todo el servicio.
2. Rollout controlado y rollback rapido si algo sale mal.
3. Exposicion publica limpia con Ingress + ALB, sin gestionar manualmente balanceador por app.
4. Observabilidad basica inmediata con `kubectl get pods`, eventos y health checks.
5. Escalabilidad: puedo subir replicas en Deployment sin redisenar la app.
6. Trazabilidad real por commit/tag de imagen, util para auditoria de cambios.

En resumen: para cambios frecuentes, este flujo me da mas seguridad que subir archivos a mano en un servidor unico.

## Archivos clave

1. Aplicacion: [server.js](server.js)
2. Imagen: [Dockerfile](Dockerfile)
3. Cluster: [cluster.yaml](cluster.yaml)
4. Manifiestos k8s: [k8s/deployment.yaml](k8s/deployment.yaml), [k8s/service.yaml](k8s/service.yaml), [k8s/ingress.yaml](k8s/ingress.yaml)
5. IAM OIDC: [iam/trust-policy.json](iam/trust-policy.json), [iam/deploy-policy.json](iam/deploy-policy.json)
6. Pipeline: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## Limpieza recomendada (para evitar costos)

```bash
kubectl delete -f k8s/ingress.yaml
kubectl delete -f k8s/service.yaml
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/namespace.yaml

eksctl delete cluster --name jonathan-eks-lab --region us-east-1 --wait
aws ecr delete-repository --repository-name ejercicio-curso-app --force --region us-east-1
aws iam delete-role-policy --role-name GitHubOIDCDeployRole --policy-name deploy
aws iam delete-role --role-name GitHubOIDCDeployRole
```
