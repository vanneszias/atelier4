import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@cloudflare/kumo";
import type { StoredSubmission } from "./index";
import {
  defaultMaintenanceMessage,
  type SiteAvailability,
} from "../../lib/maintenance";
// Ship styles with the lazy-loaded admin page. Public theme styles never reach
// this surface, and arbitrary plugin classes are not scanned by EmDash's CSS build.
const adminStyles = `
.a4-admin { --a4-border: var(--color-kumo-line, light-dark(#e4e4e7, #303033)); --a4-surface: var(--color-kumo-base, light-dark(#fff, #111113)); --a4-soft: var(--color-kumo-tint, light-dark(#f7f7f8, #1a1a1d)); --a4-muted: var(--text-color-kumo-subtle, light-dark(#65656d, #a1a1aa)); padding: clamp(1rem, 3vw, 2rem); width: 100%; max-width: 90rem; min-width: 0; font-size: .875rem; line-height: 1.55; }
.a4-admin *, .a4-admin *::before, .a4-admin *::after { box-sizing: border-box; }
.a4-admin h1, .a4-admin h2, .a4-admin p { margin: 0; }
.a4-admin h1 { font-size: clamp(1.5rem, 2vw, 1.875rem); font-weight: 650; letter-spacing: -.025em; line-height: 1.2; }
.a4-admin h2 { font-size: 1rem; font-weight: 600; line-height: 1.4; }
.a4-admin .a4-header { display: grid; gap: .625rem; margin-bottom: 1.75rem; }
.a4-admin .a4-muted { color: var(--a4-muted); }
.a4-admin .a4-description { max-width: 75ch; }
.a4-admin .a4-panel { border: 1px solid var(--a4-border); border-radius: .75rem; background: var(--a4-surface); overflow: hidden; min-width: 0; }
.a4-admin .a4-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 1.25rem; border-bottom: 1px solid var(--a4-border); }
.a4-admin .a4-actions { display: flex; align-items: center; gap: .625rem; flex-wrap: wrap; }
.a4-admin .a4-field { display: grid; gap: .5rem; min-width: 0; }
.a4-admin .a4-label { font-weight: 550; }
.a4-admin select, .a4-admin textarea { border: 1px solid var(--a4-border); border-radius: .5rem; background: var(--a4-surface); color: inherit; font: inherit; }
.a4-admin select { min-width: 12rem; min-height: 2.5rem; padding: .5rem 2rem .5rem .75rem; }
.a4-admin textarea { display: block; width: 100%; padding: .875rem; min-height: 10rem; resize: vertical; line-height: 1.6; }
.a4-admin select:focus-visible, .a4-admin textarea:focus-visible, .a4-admin input:focus-visible, .a4-admin .a4-scroll:focus-visible { outline: 2px solid var(--color-kumo-brand, #7373e8); outline-offset: 3px; }
.a4-admin .a4-scroll { overflow-x: auto; }
.a4-admin table { width: 100%; min-width: 58rem; border-collapse: collapse; text-align: start; font-size: .875rem; }
.a4-admin caption { text-align: start; padding: 1rem 1.25rem; color: var(--a4-muted); font-size: .8125rem; }
.a4-admin th { text-align: start; background: var(--a4-soft); font-size: .75rem; font-weight: 600; color: var(--a4-muted); white-space: nowrap; }
.a4-admin th, .a4-admin td { padding: .875rem 1.25rem; border-bottom: 1px solid var(--a4-border); vertical-align: top; }
.a4-admin tbody tr:last-child td { border-bottom: 0; }
.a4-admin tbody tr:hover { background: var(--a4-soft); }
.a4-admin .a4-person { display: grid; gap: .25rem; min-width: 12rem; }
.a4-admin .a4-person strong { font-weight: 550; }
.a4-admin .a4-email { color: var(--a4-muted); overflow-wrap: anywhere; }
.a4-admin .a4-email:hover { text-decoration: underline; }
.a4-admin .a4-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.a4-admin .a4-date span { display: block; font-size: .75rem; color: var(--a4-muted); }
.a4-admin .a4-details { min-width: 14rem; max-width: 32rem; }
.a4-admin .a4-message { white-space: pre-wrap; overflow-wrap: anywhere; }
.a4-admin .a4-details > * + * { margin-top: .375rem; }
.a4-admin .a4-tags { display: flex; gap: .375rem; flex-wrap: wrap; }
.a4-admin .a4-badge { display: inline-flex; align-items: center; gap: .375rem; border: 1px solid var(--a4-border); background: var(--a4-soft); padding: .125rem .5rem; border-radius: .375rem; font-size: .75rem; font-weight: 500; white-space: nowrap; }
.a4-admin .a4-state { padding: 3rem 1.25rem; display: grid; gap: .375rem; text-align: center; }
.a4-admin .a4-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; padding: 1rem 1.25rem; border-top: 1px solid var(--a4-border); }
.a4-admin .a4-alert { border: 1px solid var(--a4-border); border-radius: .5rem; padding: .875rem 1rem; margin-bottom: 1rem; background: var(--a4-soft); }
.a4-admin .a4-alert[role="alert"] { border-inline-start: 3px solid #d35c5c; }
.a4-admin .a4-alert[role="status"] { border-inline-start: 3px solid #489a6f; }
.a4-admin .a4-availability { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; max-width: 75rem; }
.a4-admin fieldset { display: grid; gap: 1.5rem; padding: 1.5rem; margin: 0; border: 0; min-width: 0; }
.a4-admin .a4-panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--a4-border); }
.a4-admin .a4-toggle { display: flex; align-items: start; gap: .75rem; cursor: pointer; }
.a4-admin .a4-toggle input { width: 1.125rem; height: 1.125rem; flex: none; margin-top: .1875rem; accent-color: var(--color-kumo-brand, #3546e8); }
.a4-admin .a4-toggle-text { display: grid; gap: .25rem; }
.a4-admin .a4-help { font-size: .8125rem; color: var(--a4-muted); }
.a4-admin .a4-help-row { display: flex; justify-content: space-between; gap: 1rem; }
.a4-admin .a4-preview-wrap { padding: 1.5rem; }
.a4-admin .a4-preview { padding: clamp(1.25rem, 3vw, 2rem); background: #3546e8; color: #f6f3ea; border-radius: .5rem; }
.a4-admin .a4-preview h2 { font-size: clamp(1.5rem, 2vw, 2rem); font-weight: 800; line-height: 1.15; letter-spacing: -.025em; margin-bottom: 1rem; }
.a4-admin .a4-preview p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
.a4-admin .a4-preview-wrap > .a4-help { margin-top: 1rem; }
.a4-admin .a4-dot { width: .4375rem; height: .4375rem; border-radius: 50%; background: #489a6f; }
.a4-admin .a4-dot-offline { background: #dc9750; }
@media (max-width: 960px) { .a4-admin .a4-availability { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 600px) { .a4-admin .a4-toolbar { align-items: stretch; } .a4-admin .a4-toolbar > .a4-field { width: 100%; } .a4-admin select { width: 100%; } .a4-admin fieldset, .a4-admin .a4-preview-wrap { padding: 1rem; } .a4-admin .a4-panel-heading { padding: 1rem; } }
`;
function AdminPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="a4-admin">
      <style>{adminStyles}</style>
      <header className="a4-header">
        <h1>{title}</h1>
        <p className="a4-muted a4-description">{description}</p>
      </header>
      {children}
    </section>
  );
}
const formLabels: Record<string, string> = {
  community: "Community",
  newsletter: "Newsletter",
  artist: "Artist application",
  contact: "Contact",
  registration: "Event registration",
};
type Row = { id: string; data: StoredSubmission };
const endpoint = "/_emdash/api/plugins/atelier4-community";
async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(endpoint + path, {
    ...options,
    headers: {
      "X-EmDash-Request": "1",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw Error("Request failed");
  return ((await res.json()) as { data: any }).data;
}
function Submissions() {
  const [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string>(),
    [type, setType] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(next?: string) {
    setBusy(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (type) p.set("type", type);
      if (next) p.set("cursor", next);
      const data = await api("/list?" + p);
      if (!data.ok) throw Error();
      setRows((old) => (next ? [...old, ...data.items] : data.items));
      setCursor(data.hasMore ? data.cursor : undefined);
    } catch {
      setError("Could not load submissions. Try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [type]);
  async function remove(row: Row) {
    if (
      !window.confirm(
        `Delete ${row.data.name}'s submission? This cannot be undone.`,
      )
    )
      return;
    try {
      const result = await api("/delete", {
        method: "POST",
        body: JSON.stringify({ id: row.id }),
      });
      if (!result.ok) throw Error();
      setRows((old) => old.filter((x) => x.id !== row.id));
    } catch {
      setError("Could not delete submission.");
    }
  }
  function csv() {
    const escape = (s: unknown) =>
      '"' +
      String(s ?? "")
        .replace(/^[=+@\-\t\r]/, "'" + "$&")
        .replaceAll('"', '""') +
      '"';
    const fields = [
      "type",
      "name",
      "email",
      "discipline",
      "message",
      "updates",
      "help",
      "eventId",
      "createdAt",
    ] as const;
    const content = [
      fields.join(","),
      ...rows.map((row) => fields.map((k) => escape(row.data[k])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier4-submissions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminPage
      title="Community & forms"
      description="Manage private requests, artist applications and update preferences."
    >
      {error && (
        <p className="a4-alert" role="alert">
          {error}
        </p>
      )}
      <div className="a4-panel" aria-busy={busy}>
        <div className="a4-toolbar">
          <label className="a4-field">
            <span className="a4-label">Form</span>
            <select
              disabled={busy}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All forms</option>
              {Object.entries(formLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="a4-actions">
            <Button
              variant="secondary"
              onClick={() => void load()}
              disabled={busy}
            >
              {busy ? "Loading…" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              onClick={csv}
              disabled={busy || !rows.length}
            >
              Export CSV
            </Button>
          </div>
        </div>
        {rows.length > 0 ? (
          <div
            className="a4-scroll"
            tabIndex={0}
            role="region"
            aria-label="Private submissions"
          >
            <table>
              <caption>
                {rows.length} {rows.length === 1 ? "submission" : "submissions"}{" "}
                loaded{type ? ` · ${formLabels[type]}` : " · All forms"}
              </caption>
              <thead>
                <tr>
                  {[
                    "Received",
                    "Form",
                    "Person",
                    "Details",
                    "Preferences",
                    "Actions",
                  ].map((x) => (
                    <th key={x} scope="col">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="a4-date">
                      <time dateTime={row.data.createdAt}>
                        {new Date(row.data.createdAt).toLocaleDateString()}
                        <span>
                          {new Date(row.data.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </time>
                    </td>
                    <td>
                      <span className="a4-badge">
                        {formLabels[row.data.type] || row.data.type}
                      </span>
                    </td>
                    <td>
                      <div className="a4-person">
                        <strong>{row.data.name || "—"}</strong>
                        <a
                          className="a4-email"
                          href={`mailto:${row.data.email}`}
                        >
                          {row.data.email}
                        </a>
                      </div>
                    </td>
                    <td className="a4-details">
                      {row.data.discipline && (
                        <p className="a4-label">{row.data.discipline}</p>
                      )}
                      {row.data.message && (
                        <p className="a4-message">{row.data.message}</p>
                      )}
                      {row.data.eventId && (
                        <p className="a4-help">Event: {row.data.eventId}</p>
                      )}
                      {!row.data.discipline &&
                        !row.data.message &&
                        !row.data.eventId && (
                          <span className="a4-muted">—</span>
                        )}
                    </td>
                    <td>
                      <div className="a4-tags">
                        {row.data.updates && (
                          <span className="a4-badge">Updates consent</span>
                        )}
                        {row.data.help && (
                          <span className="a4-badge">Wants to help</span>
                        )}
                        {!row.data.updates && !row.data.help && (
                          <span className="a4-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        onClick={() => void remove(row)}
                        aria-label={`Delete ${row.data.name || row.data.email}'s submission`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="a4-state" role="status">
            <h2>
              {busy
                ? "Loading submissions…"
                : error
                  ? "Submissions unavailable"
                  : "No submissions yet"}
            </h2>
            <p className="a4-muted">
              {busy
                ? "Fetching private form responses."
                : error
                  ? "Use Refresh to try again."
                  : type
                    ? "There are no responses for this form."
                    : "New form responses will appear here."}
            </p>
          </div>
        )}
        <div className="a4-footer">
          <p className="a4-help">
            Artist applications stay private. Newsletter delivery is managed
            separately.
          </p>
          {cursor && (
            <Button
              variant="secondary"
              onClick={() => void load(cursor)}
              disabled={busy}
            >
              Load more
            </Button>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function Availability() {
  const [value, setValue] = useState<SiteAvailability>({
    offline: false,
    message: defaultMaintenanceMessage,
  });
  const [saved, setSaved] = useState<SiteAvailability>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api("/availability");
      if (!result.ok) throw Error();
      setValue(result.availability);
      setSaved(result.availability);
    } catch {
      setError("Could not load site availability. Try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/availability-save", {
        method: "POST",
        body: JSON.stringify(value),
      });
      if (!result.ok) throw Error();
      setValue(result.availability);
      setSaved(result.availability);
      const staging =
        window.location.hostname.startsWith("staging.") ||
        window.location.hostname === "localhost";
      setNotice(
        staging
          ? "Saved in staging. The production website has not changed."
          : result.availability.offline
            ? "Saved. Production visitors now see your maintenance message."
            : "Saved. The production website is online.",
      );
    } catch {
      setError(
        "Could not save site availability. Your changes have not been confirmed; reload to check the current status.",
      );
    } finally {
      setBusy(false);
    }
  }
  const dirty =
    saved &&
    (saved.offline !== value.offline || saved.message !== value.message);
  return (
    <AdminPage
      title="Site availability"
      description="Control what public visitors see while you work on the website. The admin stays accessible."
    >
      {loading && (
        <p className="a4-alert" role="status">
          Loading site availability…
        </p>
      )}
      {error && (
        <p className="a4-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="a4-alert" role="status">
          {notice}
        </p>
      )}
      {!loading && !saved && (
        <Button variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      )}
      {saved && (
        <div className="a4-availability">
          <form
            className="a4-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="a4-panel-heading">
              <h2>Public access</h2>
              <span
                className="a4-badge"
                role="status"
                aria-label={`Saved status: ${saved.offline ? "Offline for public visitors" : "Online"}`}
              >
                <span
                  className={`a4-dot${saved.offline ? " a4-dot-offline" : ""}`}
                  aria-hidden="true"
                />
                {saved.offline ? "Offline" : "Online"}
              </span>
            </div>
            <fieldset disabled={loading || busy}>
              <label className="a4-toggle">
                <input
                  type="checkbox"
                  checked={value.offline}
                  onChange={(event) => {
                    setValue({ ...value, offline: event.target.checked });
                    setNotice("");
                  }}
                />
                <span className="a4-toggle-text">
                  <span className="a4-label">Take the public site offline</span>
                  <span className="a4-help">
                    Visitors will see your maintenance message instead of the
                    website.
                  </span>
                </span>
              </label>
              <div className="a4-field">
                <label className="a4-label" htmlFor="maintenance-message">
                  Message for visitors
                </label>
                <textarea
                  id="maintenance-message"
                  rows={6}
                  maxLength={3000}
                  value={value.message}
                  onChange={(event) => {
                    setValue({ ...value, message: event.target.value });
                    setNotice("");
                  }}
                  aria-describedby="maintenance-help"
                />
                <div className="a4-help-row">
                  <span className="a4-help" id="maintenance-help">
                    Plain text. Leave empty to use the default message.
                  </span>
                  <span className="a4-help">
                    {value.message.length.toLocaleString()} / 3,000
                  </span>
                </div>
              </div>
              <p className="a4-help">
                Applies to this environment only. Changes in staging do not
                affect production.
              </p>
              <div className="a4-actions">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!dirty || busy}
                >
                  {busy ? "Saving…" : "Save availability"}
                </Button>
                <span className="a4-help">
                  {dirty ? "Unsaved changes" : "All changes saved"}
                </span>
              </div>
            </fieldset>
          </form>
          <aside
            className="a4-panel"
            aria-labelledby="maintenance-preview-heading"
          >
            <div className="a4-panel-heading">
              <h2 id="maintenance-preview-heading">Visitor message preview</h2>
              <span className="a4-help">
                {value.offline ? "Shown after saving" : "Preview only"}
              </span>
            </div>
            <div className="a4-preview-wrap">
              <div className="a4-preview">
                <h2>Even achter de schermen.</h2>
                <p>{value.message.trim() || defaultMaintenanceMessage}</p>
              </div>
              <p className="a4-help">
                This preview updates as you type. Public access changes only
                after saving.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AdminPage>
  );
}

export const pages = {
  "/submissions": Submissions,
  "/availability": Availability,
};
