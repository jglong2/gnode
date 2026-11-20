# gnode

A live map of what's running on my homelab. Static HTML/CSS/JS, served by nginx on Kubernetes.

## Layout

```
site/            the website (edit site/js/config.js to add services)
Dockerfile       nginx:alpine + site/
.github/workflows/build.yml   builds + pushes ghcr.io/<owner>/<repo> on every push to main
k8s/website.yaml  Namespace + Deployment + Service + Ingress (replaces ~/k8s/website.yaml)
```

## Adding a service to the page

Add an entry to `services` in `site/js/config.js`, commit, push. Live services with a `url` get a real reachability check from the visitor's browser.

## Deploy

```sh
# 1. After the first Actions run: GitHub → Packages → <repo> → Package settings → make public

# 2. Set the image in k8s/website.yaml to ghcr.io/<owner>/<repo>:latest, then from Windows:
scp k8s/website.yaml griffin@homeserver:~/k8s/website.yaml
ssh griffin@homeserver "kubectl apply -f ~/k8s/website.yaml"

# 3. After later pushes, pull the new image:
ssh griffin@homeserver "kubectl rollout restart deployment website -n website"
```

Traffic path: gnode.net → Cloudflare → tunnel (cloudflared pods) → Traefik → website service → nginx.
