import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo";
import type { StoredSubmission } from "./index";
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
export const pages = { "/submissions": Submissions };
