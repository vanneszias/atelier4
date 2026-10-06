# Atelier 4

A modular, accessible NL/EN website for young people discovering Jesus and art together, growing out of Kunstenkamp. Built with Astro and EmDash on Cloudflare Workers, D1, R2, Images and KV.

```sh
bun install --frozen-lockfile
bun dev
```

CMS: `http://localhost:4321/_emdash/admin`.

The landing page is composed of typed editable blocks. Events, artist profiles, stories and galleries use live CMS content. Private forms are managed through the community plugin. The brand assets are derived from the supplied Atelier4 SVG; typography uses Futura with a bundled Jost fallback.

| Branch  | Environment                             | Domain                 |
| ------- | --------------------------------------- | ---------------------- |
| develop | staging, protected by Cloudflare Access | staging.ateliervier.be |
| master  | live                                    | ateliervier.be         |

Pushes deploy their environment. The manual **Release** workflow promotes a successfully staged develop commit to master, creates a version tag, deploys live and publishes a GitHub Release. Master pushes also support hotfixes.

See [operations, setup, editing, releases and content transfer](docs/OPERATIONS.md). Deployment requires `CLOUDFLARE_API_TOKEN`; OpenPanel requires your public project client ID. Separate environment infrastructure is defined in `wrangler.jsonc`.
