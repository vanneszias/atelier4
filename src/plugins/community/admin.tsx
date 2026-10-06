import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo";
import type { StoredSubmission } from "./index";
import { defaultMaintenanceMessage, type SiteAvailability } from "../../lib/maintenance";
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
    <section style={{ padding: "2rem", maxWidth: "100%" }}>
      <h1>Community & forms</h1>
      <p>
        Private requests and update preferences. Artist applications are never
        published automatically. Newsletter delivery is managed separately.
      </p>
      <label>
        Form{" "}
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All</option>
          {["community", "newsletter", "artist", "contact", "registration"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </label>
      <Button onClick={() => void load()} disabled={busy}>
        Refresh
      </Button>
      <Button onClick={csv} disabled={!rows.length}>
        Export loaded rows as CSV
      </Button>
      {error && <p role="alert">{error}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", textAlign: "left" }}>
          <caption>Private submissions ({rows.length} loaded)</caption>
          <thead>
            <tr>
              {[
                "Received",
                "Type",
                "Name",
                "Email",
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
                <td>{new Date(row.data.createdAt).toLocaleString()}</td>
                <td>{row.data.type}</td>
                <td>{row.data.name}</td>
                <td>{row.data.email}</td>
                <td>
                  {row.data.discipline}
                  <p style={{ whiteSpace: "pre-wrap", maxWidth: "40ch" }}>
                    {row.data.message}
                  </p>
                  {row.data.eventId}
                </td>
                <td>
                  {row.data.updates ? "Updates consent · " : ""}
                  {row.data.help ? "Wants to help" : ""}
                </td>
                <td>
                  <Button onClick={() => void remove(row)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && !busy && <p>No submissions yet.</p>}
      {cursor && (
        <Button onClick={() => void load(cursor)} disabled={busy}>
          Load more
        </Button>
      )}
    </section>
  );
}
function Availability() {
  const [value, setValue] = useState<SiteAvailability>({ offline: false, message: defaultMaintenanceMessage });
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
  useEffect(() => { void load(); }, []);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/availability-save", { method: "POST", body: JSON.stringify(value) });
      if (!result.ok) throw Error();
      setValue(result.availability);
      setSaved(result.availability);
      const staging = window.location.hostname.startsWith("staging.") || window.location.hostname === "localhost";
      setNotice(staging ? "Saved in staging. The production website has not changed."
        : result.availability.offline ? "Saved. Production visitors now see your maintenance message."
        : "Saved. The production website is online.");
    } catch {
      setError("Could not save site availability. Your changes have not been confirmed; reload to check the current status.");
    } finally {
      setBusy(false);
    }
  }
  const dirty = saved && (saved.offline !== value.offline || saved.message !== value.message);
  return (
    <section style={{ padding: "2rem", maxWidth: "48rem" }}>
      <h1>Site availability</h1>
      <p>Temporarily replace the production website with a message for visitors. The admin stays accessible.</p>
      <p>These settings apply to this environment only. Changes in staging do not take the production site offline.</p>
      {loading && <p role="status">Loading site availability…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !saved && <Button onClick={() => void load()}>Try again</Button>}
      {saved && <>
        <p role="status"><strong>Saved status: {saved.offline ? "Offline for public visitors" : "Online"}</strong></p>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={loading || busy} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "1.5rem", minWidth: 0 }}>
            <label style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>
              <input type="checkbox" checked={value.offline} onChange={(event) => { setValue({ ...value, offline: event.target.checked }); setNotice(""); }} />
              Take the public site offline
            </label>
            <label style={{ display: "grid", gap: ".5rem" }}>
              Message for visitors
              <textarea rows={6} maxLength={3000} value={value.message} onChange={(event) => { setValue({ ...value, message: event.target.value }); setNotice(""); }} aria-describedby="maintenance-help" style={{ width: "100%", padding: ".75rem", border: "1px solid currentColor", borderRadius: ".5rem", font: "inherit", color: "inherit", background: "transparent", resize: "vertical" }} />
              <span id="maintenance-help">Plain text, up to 3,000 characters. Leave empty to use the default message.</span>
            </label>
            <div style={{ padding: "1.5rem", background: "#3546e8", color: "#f6f3ea", borderRadius: ".5rem" }}>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.2, marginBottom: "1rem" }}>Even achter de schermen.</h2>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 }}>{value.message.trim() || defaultMaintenanceMessage}</p>
            </div>
            <div><Button type="submit" disabled={!dirty || busy}>{busy ? "Saving…" : "Save availability"}</Button></div>
          </fieldset>
        </form>
      </>}
      {notice && <p role="status" style={{ marginTop: "1rem" }}>{notice}</p>}
    </section>
  );
}
export const pages = { "/submissions": Submissions, "/availability": Availability };
