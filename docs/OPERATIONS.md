# Atelier 4 operations

## Environments

| Environment | Branch  | Worker           | URL                            | D1               | R2                     | Session KV               |
| ----------- | ------- | ---------------- | ------------------------------ | ---------------- | ---------------------- | ------------------------ |
| Staging     | develop | atelier4-staging | https://staging.ateliervier.be | atelier4-staging | atelier4-media-staging | atelier4-session-staging |
| Live        | master  | atelier4-live    | https://ateliervier.be         | atelier4-live    | atelier4-media-live    | atelier4-session-live    |

D1, media and session bindings are explicitly repeated per environment. The generated deployment configuration is checked before deployment. workers.dev and preview URLs are disabled to prevent bypassing staging Access. Only Atelier4 resources are managed here. Cloudflare domain DNS/email records outside the website are not managed by this project.

The infrastructure IDs in `wrangler.jsonc` identify resources already provisioned in the owner account. Databases have EU jurisdiction. R2 buckets are in Western Europe. The staging Access application was created for zias@zias.be and vanneszias@icloud.com. Add team email addresses to its **Atelier4 owner** policy. Do not use an everyone/bypass policy.

## Finish deployment authentication

Create a Cloudflare deployment API token scoped to account `6495d15c9d09b19ddc65f0a01892a183` and zone `ateliervier.be`, with the Wrangler Worker deployment permissions (Workers Scripts Edit, D1 Edit, Workers KV Storage Edit, Workers R2 Storage Edit, Account Settings Read, and Workers Routes Edit / Zone Read for custom domains). Cloudflare token administration is not exposed to this connection. If the account offers Worker-specific resource restrictions, select only `atelier4-staging` and `atelier4-live`.

Save the token in this GitHub repository's Actions secrets as `CLOUDFLARE_API_TOKEN`. Prefer separate tokens in GitHub environments `staging` and `live` if available. Never commit tokens to files or enter them in issue/PR comments. Environment secrets are consumed by the reusable deployment job; repository secrets also work.

Workers Loader (registry plugins) requires a Workers paid plan. If deploying reports that restriction, enable the required plan in Cloudflare rather than removing the isolation layer. This repository intentionally retains the full EmDash plugin capability.

Run the **Deploy** workflow on `develop` and `master`, or push commits to those branches. Both environments build from the Bun lockfile. The live job never shares staging data. A build completing locally does not mean either domain is deployed.

## First CMS setup

An owner-only Cloudflare Access application currently protects all of `ateliervier.be/_emdash`, preventing an unknown visitor claiming the first administrator. Keep that protection through setup. It also blocks public form endpoints. Narrowing its scope to admin/setup endpoints was rejected by automatic approval review because of possible exposure of other CMS APIs; the existing policy remains unchanged. Review the EmDash authentication boundary and obtain explicit owner approval before changing this policy. Public live forms cannot be considered launched while this protection covers them. Staging remains protected in its entirety.

Open `/_emdash/admin` on each environment and complete owner setup with your own passkey. Choose to include starter content. The seed contains the approved initial NL/EN copy and event concepts marked **preparation**, not dated or open for registration. Configure the site public URL for that environment.

Generate a distinct encryption key per environment:

```sh
bunx emdash secrets generate
bunx wrangler secret put EMDASH_ENCRYPTION_KEY --env staging
bunx wrangler secret put EMDASH_ENCRYPTION_KEY --env live
```

Paste the separately generated key into each prompt. Keep keys in your password manager; encrypted plugin settings require the same keys after a restore. Preview signing uses EmDash's per-site DB secret automatically. Explicit preview-secret overrides, if used, must also be different per environment. Secrets are never copied by the live pull command.

The platform scheduler calls EmDash every minute. This handles scheduled publishing and plugin maintenance. Enable roles through EmDash; give publishing rights only to appropriate team members. Submissions currently require `plugins:manage` because they contain personal data.

## Daily editing

- **Pages → home:** add, reorder or remove typed sections. Edit heading, copy, colour, links, imagery and items without changing code.
- Blocks: hero, mission, art-form grid, events, artists, stories, gallery, FAQs, CTA and forms.
- Collections: events, artists, stories, galleries and pages. Drafts, revisions, signed previews, scheduling, search and SEO are enabled for each.
- Create NL/EN translations from the editor. Each locale has separate publication status. NL is unprefixed and EN lives under `/en`; keep the default locale unprefixed so the CMS admin continues working.
- Menus `primary_nl` and `primary_en` control navigation. Footer widget areas and the story sidebar support reusable widgets/sections. Bylines and discipline taxonomies remain available through the CMS. Stories expose moderated built-in comments.
- Editors can upload media to their environment's own R2 bucket, with alt text. Give every meaningful image descriptive alternative text; decorative images should have empty alt text. Avoid adding multiple hero blocks to one page.

Futura is used when installed. A bundled Jost fallback keeps the intended geometric style across devices without third-party font requests. Replace it with licensed Futura webfont files when those are available; the reference SVG contains Futura font names, not a webfont licence or font files.

## Forms

Community, newsletter-interest, artist application, contact and event registration forms store submissions in a plugin-private indexed store. Manage them under **Community & forms**; filter, load more, export loaded rows as CSV, or delete a request. Applications never automatically create public artist profiles. The CSV export escapes formula prefixes. Updates require separate explicit consent. No form details are passed to analytics.

Forms validate at the server boundary, require same-origin submissions, have a honeypot, idempotent request IDs and an atomic per-minute rate limit. Turnstile is optional; configure the site key and encrypted secret under the community plugin settings to activate verification. Non-update requests expire after a year via scheduled maintenance; subscribed update requests remain until removed/unsubscribed.

The update form collects **interest and consent**; it does not yet send marketing emails or double-opt-in confirmations. Connect your chosen mailing provider before sending updates, including an unsubscribe mechanism. Contact and artist requests are received in the admin; automatic email forwarding is not configured. The existing contact mailbox remains usable via the email links.

Events start closed. To accept free registrations, publish the event with state `open` and enable registrations. In preparation, sold-out, past and draft events are rejected by the server. Capacity-controlled or paid events must have an external registration/ticketing URL; the built-in interest form deliberately does not handle payments or promise capacity guarantees.

## OpenPanel

In the community plugin settings, enter your **public client ID** and optional API URL (default `https://api.openpanel.dev`). Do not put a client secret in the browser. Analytics is off without a client ID, off on staging, and off until visitor consent. It respects Do Not Track / Global Privacy Control. Only origin/path are sent; query parameters and form values are excluded. Visitors can change the choice through the footer privacy control.

## Releases and hotfixes

A push to `develop` runs tests/type checks/build and deploys staging. A push to `master` does the same for live. For a release:

1. Ensure the develop commit has a successful **Deploy** run to staging.
2. Run **Release** from `master`, entering a new semantic tag such as `v1.0.0`.
3. It checks that `master` is an ancestor of the exact develop commit. Merge live hotfixes back to develop before releasing.
4. It atomically fast-forwards master and creates the tag, deploys that exact commit to live, then publishes the GitHub Release with generated notes.

The release calls the reusable live job explicitly: pushes made with GitHub's built-in token do not start a second workflow. Tags are immutable; a retry accepts only an existing tag pointing to the same commit. If develop advanced after a failed attempt, do not reuse that tag for another commit. Re-run the existing job or use a new tag. A release is only published after successful live deployment. Release deployments and hotfix deployments share an environment lock and reject stale branch commits.

## Pull live content

```sh
export EMDASH_TOKEN_LIVE='<live token with transfer:export scope>'
bun run pull:live
# Or export then analyze a copy into an empty local/staging CMS:
bun run pull:live local
bun run pull:live staging
```

Staging needs `EMDASH_TOKEN_STAGING` and `EMDASH_HEADERS_STAGING` containing its Cloudflare Access service-token headers. Create an Atelier4-only Access service-token policy; the owner-only browser policy is not a CI bypass.

The `.emdash` package includes schema, content, history, settings and media, and excludes users and secrets. It may contain author/commenter personal data; `.backups` is private and gitignored. The script exports and analyzes only. Review the printed plan/digest and run EmDash's explicit `--plan <digest> --confirm` command to import. The supported native importer requires an empty target; it never silently overwrites an existing staging database. For refreshing a populated staging site, provision a fresh staging DB/bucket, import while Access remains enabled, then switch only staging's bindings. Keep a backup of the old staging environment.

Do not clone raw live SQL into staging: that would copy live accounts, sessions and secrets, defeating the separation.

## Validation

`bun test tests`, `bun run typecheck`, `CLOUDFLARE_ENV=staging bun run build`, and `CLOUDFLARE_ENV=staging node scripts/check-deployment.mjs`. Repeat the build/config check for live. Before launch, verify both languages on mobile and desktop, keyboard navigation, forms, private submission access, CMS previews, scheduled publication, and an unauthenticated Access redirect on staging. Live CMS setup, analytics credentials and deployment credentials are owner tasks until authenticated access is available.

## Current handoff status

The initial implementation is published to both `develop` and `master`. Repository pushes trigger deployment workflows; publishing the code is separate from successfully deploying the Workers. Do not force-push over newer remote changes.

Provisioned: separate staging/live D1 databases, R2 media buckets, session KV namespaces and owner Access applications. Not yet deployed: Workers and their custom domains. Authentication, separate encryption keys, first-owner setup and the OpenPanel public client ID still need completion.

Local verification passed: schema/seed validation, form boundary tests, Astro type checking, staging/live production builds and binding assertions, NL/EN HTTP routes, real submission persistence/deletion and anonymous private-route rejection. Browser visual/keyboard/axe verification remains pending because the browser download failed in this workspace. Scheduled publication, CMS preview links, live Turnstile and CI promotion require deployed environment verification before claiming launch readiness.
