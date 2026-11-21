// ─────────────────────────────────────────────────────────────
//  gnode — homelab config
//  Edit this file to change what the site shows. No build step:
//  commit + push and GitHub Actions ships a new image.
// ─────────────────────────────────────────────────────────────
window.GNODE = {
  hostname: "gnode",          // brand / domain name shown on the page
  nodeName: "homeserver",     // the actual k8s node name
  tagline: "One mini PC on an apartment network, running k3s, reachable from anywhere through a Cloudflare Tunnel with zero open ports.",
  // Date the lab went live (used for the "online for" counter)
  onlineSince: "2026-11-20T00:00:00",

  // Hardware / platform facts shown in the "Node" panel.
  node: [
    { label: "Hardware", value: "GMKtec G10" },
    { label: "CPU",      value: "Ryzen 5 3500U · 4c/8t" },
    { label: "Memory",   value: "16 GB" },
    { label: "Storage",  value: "512 GB SSD" },
    { label: "Network",  value: "2.5 GbE" },
    { label: "OS",       value: "Ubuntu Server 26.04 LTS" },
    { label: "Cluster",  value: "k3s · single node" },
    { label: "Ingress",  value: "Traefik" },
    { label: "Edge",     value: "Cloudflare Tunnel" },
    { label: "Inbound ports", value: "0" },
  ],

  // Everything hosted on the lab.
  //   status:   "live" | "building" | "planned"
  //   url:      optional; if set and status is "live", the visitor's browser
  //             pings it to show a real reachability indicator.
  //   pod:      optional "namespace/name" — shown in the terminal's kubectl output
  //   replicas: optional, defaults to 1
  //   via:      optional; name of the service that routes traffic to this one (see `traffic`)
  services: [
    {
      name: "gnode.net",
      kind: "web",
      status: "live",
      url: "/",
      pod: "website/website",
      via: "traefik",
      desc: "This page. Static files in an nginx container, built by GitHub Actions and pulled from GHCR.",
      tags: ["nginx", "traefik", "ghcr"],
    },
    {
      name: "cloudflared",
      kind: "edge",
      status: "live",
      pod: "cloudflare/cloudflared",
      replicas: 2,
      desc: "Outbound-only Cloudflare Tunnel running in the cluster. TLS ends at Cloudflare and traffic is handed to Traefik.",
      tags: ["cloudflare", "tunnel", "2 replicas"],
    },
    {
      name: "traefik",
      kind: "ingress",
      status: "live",
      pod: "kube-system/traefik",
      desc: "k3s's built-in ingress controller. Routes each hostname to the right service.",
      tags: ["k3s", "ingress"],
    },
    {
      name: "tailscale",
      kind: "access",
      status: "live",
      desc: "Private mesh VPN for SSH and kubectl from anywhere, without opening a single port.",
      tags: ["wireguard", "magicdns"],
    },
    {
      name: "CI / CD",
      kind: "pipeline",
      status: "live",
      desc: "Every push to main builds a container image and publishes it to GitHub Container Registry.",
      tags: ["github actions", "ghcr"],
    },
    {
      name: "griffinlong.com",
      kind: "web",
      status: "live",
      url: "https://www.griffinlong.com",
      pod: "griffinlong/griffinlong",
      via: "traefik",
      desc: "My personal site. Moved off DreamHost onto the homeserver and served by nginx, through the same tunnel and Traefik as this page.",
      tags: ["nginx", "traefik", "ghcr"],
    },
  ],

  // Public traffic path drawn on the topology:
  // internet → traffic[0] → … → traffic[last] → every service with `via` set to traffic[last].
  traffic: ["cloudflared", "traefik"],

  // Links in the footer
  links: [
    { label: "GitHub", url: "https://github.com/jglong2/gnode" },
  ],
};
