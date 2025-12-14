Deploy this solution to a VPS running K3S.

The deployment uses:

- Namespace: reportai
- Container engine: podman
- Container registry: registry.beecoders.com

## 1) Configure your VPS

- Install K3S
- Ensure kubectl works on the VPS (e.g. `kubectl get nodes`)
- Ensure an ingress controller exists (the manifests assume Traefik via `ingressClassName: traefik`)

## 2) Create required Kubernetes secrets

This repository ships an example secret manifest:

- k8s/reportai/sqlrest-secret.example.yaml

Copy it, fill in real values, and apply it on the VPS:

- `kubectl apply -f <your-secret-file>.yaml`

## 3) Configure frontend runtime URLs

The frontends load runtime config from:

- `excel-grid/public/runtime-config.js`
- `reportmaker/public/runtime-config.js`

In K3S, these are supplied via ConfigMaps in:

- `k8s/reportai/runtime-configs.yaml`

Update the example hostnames/URLs there before deploying.

## 4) Build, push, deploy

Use the included script:

- `chmod +x ./scripts/deploy-k3s.sh`
- `./scripts/deploy-k3s.sh all`

It will:

- Build images with podman
- Push images to registry.beecoders.com
- Copy and apply the manifests under `k8s/reportai/` to the VPS

You can also run stages individually:

- `./scripts/deploy-k3s.sh build`
- `./scripts/deploy-k3s.sh push`
- `./scripts/deploy-k3s.sh deploy`
- `./scripts/deploy-k3s.sh status`

## Notes

- The script uses `ssh` to run `kubectl` on the VPS, so the VPS user must have access to the K3S cluster.
- If `registry.beecoders.com` requires authentication for pulling images, configure node-level registry credentials or create and reference an `imagePullSecret`.


