# EKS deployment lab

Repositorio para desplegar una app Node.js en Amazon EKS con image build en Docker, push a ECR, publicacion automatica con GitHub Actions, y exposicion publica mediante AWS Load Balancer Controller + ALB.

## Variables que debes cambiar

```bash
export AWS_REGION=YOUR_AWS_REGION
export AWS_ACCOUNT_ID=YOUR_AWS_ACCOUNT_ID
export CLUSTER_NAME=YOUR_CLUSTER_NAME
export ECR_REPO=YOUR_ECR_REPO
export GITHUB_OWNER=YOUR_GITHUB_OWNER
export GITHUB_REPO=YOUR_GITHUB_REPO
export GITHUB_FULL_REPO=$GITHUB_OWNER/$GITHUB_REPO
export NAMESPACE=demo
export DEPLOYMENT_NAME=web
export CONTAINER_NAME=web
export AWS_DEPLOY_ROLE_ARN=YOUR_AWS_DEPLOY_ROLE_ARN
export APP_VERSION=1.0.0
```

## Estructura

- [server.js](server.js) app Express con `/`, `/api` y `/healthz`
- [Dockerfile](Dockerfile) imagen de produccion
- [cluster.yaml](cluster.yaml) configuracion de EKS con `eksctl`
- [k8s/](k8s) manifiestos Kubernetes
- [iam/](iam) trust policy y deploy policy para GitHub Actions
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) pipeline de despliegue
- [alb-iam-policy.json](alb-iam-policy.json) policy para AWS Load Balancer Controller
- [demo/](demo) material opcional para demos guiadas

## App local

```bash
npm install
npm start
```

Pruebas rapidas:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/api
curl -H "Accept: text/html" http://localhost:3000/
curl http://localhost:3000/
```

## Construir imagen

```bash
docker build \
  --build-arg APP_VERSION=$APP_VERSION \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo local) \
  -t eks-deploy-lab:local .
```

## Crear el cluster

Edita [cluster.yaml](cluster.yaml) y reemplaza `YOUR_AWS_REGION` y `YOUR_CLUSTER_NAME`.

```bash
eksctl create cluster -f cluster.yaml
kubectl get nodes
```

## Crear ECR

```bash
aws ecr create-repository \
  --repository-name "$ECR_REPO" \
  --image-scanning-configuration scanOnPush=true \
  --region "$AWS_REGION"

export REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker build \
  --build-arg APP_VERSION=$APP_VERSION \
  --build-arg GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo local) \
  -t "$REGISTRY/$ECR_REPO:bootstrap" .
docker push "$REGISTRY/$ECR_REPO:bootstrap"
```

## Aplicar Kubernetes

Actualiza [k8s/deployment.yaml](k8s/deployment.yaml) con tu imagen inicial antes del primer apply.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl -n "$NAMESPACE" rollout status deployment/$DEPLOYMENT_NAME
```

Si ya instalaste el ALB controller:

```bash
kubectl apply -f k8s/ingress.yaml
kubectl -n "$NAMESPACE" get ingress
```

## AWS Load Balancer Controller

1. Crea la policy desde [alb-iam-policy.json](alb-iam-policy.json) con un nombre propio, por ejemplo `EKSLoadBalancerControllerPolicy`.
2. Crea el service account con IRSA.
3. Instala el chart Helm del controller.

Comandos base:

```bash
aws iam create-policy \
  --policy-name EKSLoadBalancerControllerPolicy \
  --policy-document file://alb-iam-policy.json

eksctl create iamserviceaccount \
  --cluster="$CLUSTER_NAME" \
  --region="$AWS_REGION" \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name EKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$AWS_ACCOUNT_ID:policy/EKSLoadBalancerControllerPolicy \
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName="$CLUSTER_NAME" \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region="$AWS_REGION"
```

## OIDC para GitHub Actions

1. Crea el provider OIDC de GitHub en AWS.
2. Sustituye los placeholders en [iam/trust-policy.json](iam/trust-policy.json) y [iam/deploy-policy.json](iam/deploy-policy.json).
3. Crea el rol y adjunta la policy.
4. Crea el access entry del cluster para ese rol.
5. Guarda `AWS_DEPLOY_ROLE_ARN` como secret en GitHub.

Ejemplo:

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

export AWS_DEPLOY_ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/GitHubOIDCDeployRole"

aws eks create-access-entry \
  --cluster-name "$CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --principal-arn "$AWS_DEPLOY_ROLE_ARN" \
  --type STANDARD

aws eks associate-access-policy \
  --cluster-name "$CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --principal-arn "$AWS_DEPLOY_ROLE_ARN" \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy \
  --access-scope type=namespace,namespaces=$NAMESPACE
```

## Configurar GitHub

Agrega estos secrets o variables:

- `AWS_DEPLOY_ROLE_ARN`
- `AWS_REGION`
- `AWS_ACCOUNT_ID`
- `CLUSTER_NAME`
- `ECR_REPO`

El workflow asume `main` y usa `kubectl set image` para publicar el nuevo SHA.

## Validar URL publica

Cuando el Ingress este listo, obtiene el hostname del ALB:

```bash
kubectl -n "$NAMESPACE" get ingress web -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'; echo
```

Pruebas:

```bash
curl http://$ALB_HOSTNAME/healthz
curl http://$ALB_HOSTNAME/api
curl -H "Accept: text/html" http://$ALB_HOSTNAME/
```

## Rollback

```bash
kubectl -n "$NAMESPACE" rollout history deployment/$DEPLOYMENT_NAME
kubectl -n "$NAMESPACE" rollout undo deployment/$DEPLOYMENT_NAME
kubectl -n "$NAMESPACE" rollout status deployment/$DEPLOYMENT_NAME
```

## Limpieza

Primero elimina el Ingress para no dejar un ALB huérfano.

```bash
kubectl delete -f k8s/ingress.yaml
kubectl delete -f k8s/service.yaml
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/namespace.yaml

eksctl delete cluster --name "$CLUSTER_NAME" --region "$AWS_REGION" --wait
aws ecr delete-repository --repository-name "$ECR_REPO" --force --region "$AWS_REGION"
aws iam delete-role-policy --role-name GitHubOIDCDeployRole --policy-name deploy
aws iam delete-role --role-name GitHubOIDCDeployRole
```

## Costo aproximado

El costo depende de la region, tipo de nodo y tiempo encendido. Como referencia, un entorno pequeno con 2 nodos t3.medium, ALB y NAT Gateway suele estar en el orden de decenas o mas de cien USD al mes si queda encendido todo el tiempo. Para laboratorios cortos, el costo baja de forma importante.
