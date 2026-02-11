import { useState, useEffect, useMemo } from "react";

const INITIAL_CATEGORIES = ["Sports", "Home", "Social"];

const CATEGORY_COLORS = {
  Sports: { bg: "#e8f0fe", border: "#4285f4", text: "#1a56db", dot: "#4285f4" },
  Home: { bg: "#fef3e2", border: "#e8a23e", text: "#b06e1a", dot: "#e8a23e" },
  Social: { bg: "#f0e8fe", border: "#9b59b6", text: "#6c3483", dot: "#9b59b6" },
};

const EXTRA_COLORS = [
  { bg: "#e8fef0", border: "#2ecc71", text: "#1a7a42", dot: "#2ecc71" },
  { bg: "#fee8e8", border: "#e74c3c", text: "#a93226", dot: "#e74c3c" },
  { bg: "#fef8e2", border: "#f1c40f", text: "#9a7d0a", dot: "#f1c40f" },
  { bg: "#e8fefe", border: "#1abc9c", text: "#148f77", dot: "#1abc9c" },
  { bg: "#fde8f4", border: "#e84393", text: "#b03075", dot: "#e84393" },
  { bg: "#eee8fe", border: "#6c5ce7", text: "#4834b5", dot: "#6c5ce7" },
  { bg: "#e8ecfe", border: "#2d3436", text: "#1a1a2e", dot: "#2d3436" },
];

function getCategoryColor(cat, allCategories) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const idx = allCategories.filter((c) => !CATEGORY_COLORS[c]).indexOf(cat);
  return EXTRA_COLORS[Math.abs(idx) % EXTRA_COLORS.length];
}

function generateUID() {
  return "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateStr) {
  if (!dateStr) return "No date set";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function generateICS(event) {
  const pad = (n) => String(n).padStart(2, "0");
  const toICSDate = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  };
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : new Date(now.getTime() + 3600000);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 3600000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventStaging//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${event.id}@eventstaging`, `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${(event.title || "").replace(/[,;\\]/g, " ")}`,
    event.location ? `LOCATION:${event.location.replace(/[,;\\]/g, " ")}` : null,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n").replace(/[,;\\]/g, " ")}` : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadICS(event) {
  const blob = new Blob([generateICS(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(event.title || "event").replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadMultipleICS(events) {
  const pad = (n) => String(n).padStart(2, "0");
  const toICSDate = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  };
  const now = new Date();
  let lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EventStaging//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  events.forEach((event) => {
    const start = event.startDate ? new Date(event.startDate) : new Date(now.getTime() + 3600000);
    const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 3600000);
    lines.push("BEGIN:VEVENT", `UID:${event.id}@eventstaging`, `DTSTAMP:${toICSDate(now)}`,
      `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
      `SUMMARY:${(event.title || "").replace(/[,;\\]/g, " ")}`);
    if (event.location) lines.push(`LOCATION:${event.location.replace(/[,;\\]/g, " ")}`);
    if (event.description) lines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n").replace(/[,;\\]/g, " ")}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selected_events.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STORAGE_KEY = "event-staging-data";
async function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error("Save failed:", e); }
}

// ---- COMPONENTS ----

function CategoryPill({ name, active, count, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: "100px",
      border: active ? `2px solid ${color?.dot || "#1a1a2e"}` : "1.5px solid #d0d0d8",
      background: active ? (color?.dot || "#1a1a2e") : "transparent",
      color: active ? "#fff" : "#555",
      fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: active ? 600 : 500,
      cursor: "pointer", transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
    }}>
      {name !== "All" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color?.dot || "#999", flexShrink: 0 }} />}
      {name}
      {count > 0 && (
        <span style={{ background: active ? "rgba(255,255,255,0.25)" : "#e8e8ec", padding: "1px 7px", borderRadius: "100px", fontSize: "11px", fontWeight: 600 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function EventCard({ event, color, onExport, onDelete, onEdit, selected, onToggleSelect }) {
  const hasDate = !!event.startDate;
  const isPast = hasDate && new Date(event.startDate) < new Date();
  return (
    <div style={{
      background: "#fff", borderRadius: "14px", padding: "18px 20px",
      borderLeft: `4px solid ${color?.dot || "#999"}`,
      borderTop: "1.5px solid #e8e8ec", borderRight: "1.5px solid #e8e8ec", borderBottom: "1.5px solid #e8e8ec",
      transition: "all 0.2s ease", opacity: isPast ? 0.55 : 1,
      boxShadow: selected ? `0 0 0 2px ${color?.dot || "#1a1a2e"}` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect}
            style={{ width: 17, height: 17, accentColor: color?.dot || "#1a1a2e", cursor: "pointer", flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e", lineHeight: 1.3 }}>
              {event.title}
            </h3>
            {event.location && (
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#888", fontFamily: "'DM Sans', sans-serif" }}>📍 {event.location}</p>
            )}
          </div>
        </div>
        <span style={{
          fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
          color: color?.text || "#555", background: color?.bg || "#f4f4f6",
          padding: "3px 10px", borderRadius: "100px", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {event.category}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        {hasDate ? (
          <>
            <span style={{ fontSize: "12px", color: isPast ? "#c44" : "#555", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              {formatDate(event.startDate)}
            </span>
            {formatTime(event.startDate) && (
              <span style={{ fontSize: "12px", color: "#999", fontFamily: "'DM Sans', sans-serif" }}>
                {formatTime(event.startDate)}{event.endDate && ` – ${formatTime(event.endDate)}`}
              </span>
            )}
            {isPast && <span style={{ fontSize: "10px", color: "#c44", fontWeight: 600 }}>PAST</span>}
          </>
        ) : (
          <span style={{
            fontSize: "12px", color: "#b08d3e", fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            background: "#fdf6e3", padding: "2px 10px", borderRadius: "100px",
          }}>⏳ No date — add when ready</span>
        )}
      </div>
      {event.description && (
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#777", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, maxHeight: 44, overflow: "hidden" }}>
          {event.description}
        </p>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => onExport(event)} style={{
          padding: "7px 14px", borderRadius: "8px", border: "none", background: "#1a1a2e", color: "#f0efe9",
          fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }} title="Download .ics file for Apple Calendar">📅 Export to iCal</button>
        <button onClick={() => onEdit(event)} style={{
          padding: "7px 14px", borderRadius: "8px", border: "1.5px solid #d0d0d8", background: "transparent",
          color: "#555", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>✏️ Edit</button>
        <button onClick={() => onDelete(event.id)} style={{
          padding: "7px 14px", borderRadius: "8px", border: "1.5px solid #d0d0d8", background: "transparent",
          color: "#c44", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>🗑</button>
      </div>
    </div>
  );
}

function EventForm({ event, categories, allCategories, onSave, onCancel, onExportAfterSave }) {
  const [title, setTitle] = useState(event?.title || "");
  const [category, setCategory] = useState(event?.category || categories[0] || "");
  const [newCategory, setNewCategory] = useState("");
  const [startDate, setStartDate] = useState(event?.startDate ? event.startDate.slice(0, 16) : "");
  const [endDate, setEndDate] = useState(event?.endDate ? event.endDate.slice(0, 16) : "");
  const [location, setLocation] = useState(event?.location || "");
  const [description, setDescription] = useState(event?.description || "");
  const [useCustomCat, setUseCustomCat] = useState(false);

  const buildEvent = () => {
    const cat = useCustomCat && newCategory.trim() ? newCategory.trim() : category;
    return {
      id: event?.id || generateUID(), title: title.trim(), category: cat,
      startDate: startDate || null, endDate: endDate || null,
      location: location.trim() || null, description: description.trim() || null,
      source: event?.source || "manual", createdAt: event?.createdAt || new Date().toISOString(),
    };
  };

  const handleSave = () => { if (!title.trim()) return; onSave(buildEvent()); };
  const handleSaveAndExport = () => {
    if (!title.trim()) return;
    const evt = buildEvent();
    onSave(evt);
    onExportAfterSave(evt);
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #d0d0d8",
    fontSize: "14px", fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e", outline: "none",
    boxSizing: "border-box", background: "#fafafa",
  };
  const labelStyle = {
    fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
    color: "#888", marginBottom: "5px", display: "block", fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}
      onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "460px", maxHeight: "85vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#1a1a2e" }}>
          {event ? "Edit Event" : "New Event"}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the event?" />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: useCustomCat ? "8px" : 0 }}>
              {allCategories.map((c) => {
                const col = getCategoryColor(c, allCategories);
                return (
                  <button key={c} onClick={() => { setCategory(c); setUseCustomCat(false); }} style={{
                    padding: "6px 14px", borderRadius: "100px",
                    border: !useCustomCat && category === c ? `2px solid ${col.dot}` : "1.5px solid #d0d0d8",
                    background: !useCustomCat && category === c ? col.dot : "transparent",
                    color: !useCustomCat && category === c ? "#fff" : "#555",
                    fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: !useCustomCat && category === c ? "#fff" : col.dot }} />
                    {c}
                  </button>
                );
              })}
              <button onClick={() => setUseCustomCat(true)} style={{
                padding: "6px 14px", borderRadius: "100px",
                border: useCustomCat ? "2px solid #1a1a2e" : "1.5px dashed #d0d0d8",
                background: useCustomCat ? "#1a1a2e" : "transparent",
                color: useCustomCat ? "#fff" : "#999",
                fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>+ New</button>
            </div>
            {useCustomCat && <input style={inputStyle} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name..." autoFocus />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div><label style={labelStyle}>Start (optional)</label><input style={inputStyle} type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>End (optional)</label><input style={inputStyle} type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div><label style={labelStyle}>Location</label><input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where?" /></div>
          <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any details..." /></div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onCancel} style={{
            padding: "10px 20px", borderRadius: "10px", border: "1.5px solid #d0d0d8", background: "transparent",
            color: "#555", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim()} style={{
            padding: "10px 22px", borderRadius: "10px", border: "1.5px solid #1a1a2e",
            background: "transparent", color: title.trim() ? "#1a1a2e" : "#ccc",
            fontSize: "14px", fontWeight: 600, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
          }}>Save</button>
          <button onClick={handleSaveAndExport} disabled={!title.trim()} style={{
            padding: "10px 22px", borderRadius: "10px", border: "none",
            background: title.trim() ? "#1a1a2e" : "#ccc", color: "#f0efe9",
            fontSize: "14px", fontWeight: 600, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
          }}>Save & Export to iCal</button>
        </div>
      </div>
    </div>
  );
}

function ImportCalendarModal({ onImport, onClose, allCategories }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Sports");
  const [newCategory, setNewCategory] = useState("");
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [fileEvents, setFileEvents] = useState(null);
  const [activeTab, setActiveTab] = useState("file"); // file, url, paste
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [savedFeeds, setSavedFeeds] = useState(() => {
    try { const raw = localStorage.getItem("event-staging-feeds"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  const resolvedCategory = useCustomCat && newCategory.trim() ? newCategory.trim() : category;

  const SAMPLE_FEEDS = [
    { name: "Philadelphia Phillies", icon: "⚾", hint: "MLB baseball" },
    { name: "Philadelphia Eagles", icon: "🏈", hint: "NFL football" },
    { name: "Philadelphia 76ers", icon: "🏀", hint: "NBA basketball" },
    { name: "Philadelphia Flyers", icon: "🏒", hint: "NHL hockey" },
    { name: "US Holidays", icon: "🇺🇸", hint: "Federal holidays" },
  ];

  // ---- PARSERS ----

  const parseICSDateTime = (val) => {
    if (!val) return null;
    const clean = val.replace(/[^0-9T]/g, "");
    if (clean.length >= 8) {
      const y = clean.slice(0, 4), mo = clean.slice(4, 6), d = clean.slice(6, 8);
      const h = clean.length >= 11 ? clean.slice(9, 11) : "00";
      const mi = clean.length >= 13 ? clean.slice(11, 13) : "00";
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:00`).toISOString();
    }
    return null;
  };

  const parseICS = (text, sourceName, cat) => {
    const events = [];
    const vevents = text.split("BEGIN:VEVENT");
    for (let i = 1; i < vevents.length; i++) {
      const block = vevents[i].split("END:VEVENT")[0];
      const get = (key) => {
        // Handle multi-line folded values in ICS
        const regex = new RegExp(`${key}[^:]*:([^\\r\\n]+(?:\\r?\\n[ \\t][^\\r\\n]*)*)`, "m");
        const m = block.match(regex);
        return m ? m[1].replace(/\r?\n[ \t]/g, "").trim() : null;
      };
      const title = get("SUMMARY");
      if (title) {
        events.push({
          id: generateUID(), title, category: cat,
          startDate: parseICSDateTime(get("DTSTART")),
          endDate: parseICSDateTime(get("DTEND")),
          location: get("LOCATION") || null,
          description: get("DESCRIPTION")?.replace(/\\n/g, "\n").replace(/\\,/g, ",") || null,
          source: sourceName, createdAt: new Date().toISOString(),
        });
      }
    }
    return events;
  };

  const smartParseDate = (val) => {
    if (!val) return null;
    const v = val.trim();
    // Try native parse first
    const d = new Date(v);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) return d.toISOString();
    // Try MM/DD/YYYY, DD/MM/YYYY, etc.
    const slashMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (slashMatch) {
      let [, a, b, yr, h, mi, , ampm] = slashMatch;
      if (yr.length === 2) yr = "20" + yr;
      let month = parseInt(a), day = parseInt(b);
      if (month > 12) { month = parseInt(b); day = parseInt(a); }
      let hour = h ? parseInt(h) : 0;
      if (ampm && ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm && ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const dt = new Date(parseInt(yr), month - 1, day, hour, parseInt(mi || 0));
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
    return null;
  };

  const parseCSV = (text, sourceName, cat) => {
    const events = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return events;

    // Parse header — handle quoted fields
    const parseLine = (line) => {
      const result = [];
      let current = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuotes = !inQuotes; }
        else if ((c === "," || c === "\t" || c === ";") && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += c; }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    // Map common column names
    const findCol = (names) => headers.findIndex((h) => names.some((n) => h.includes(n)));
    const titleCol = findCol(["title", "subject", "summary", "event", "name"]);
    const startCol = findCol(["start", "date", "begin", "when", "dtstart"]);
    const endCol = findCol(["end", "finish", "dtend", "enddate", "endtime"]);
    const locationCol = findCol(["location", "place", "where", "venue"]);
    const descCol = findCol(["description", "details", "notes", "body", "desc"]);

    if (titleCol === -1 && startCol === -1) {
      // Try treating first col as title, second as date
      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length >= 1 && cols[0]) {
          events.push({
            id: generateUID(), title: cols[0], category: cat,
            startDate: cols[1] ? smartParseDate(cols[1]) : null,
            endDate: cols[2] ? smartParseDate(cols[2]) : null,
            location: cols[3] || null, description: cols[4] || null,
            source: sourceName, createdAt: new Date().toISOString(),
          });
        }
      }
      return events;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const title = titleCol >= 0 ? cols[titleCol] : cols[0];
      if (!title) continue;
      events.push({
        id: generateUID(), title, category: cat,
        startDate: startCol >= 0 ? smartParseDate(cols[startCol]) : null,
        endDate: endCol >= 0 ? smartParseDate(cols[endCol]) : null,
        location: locationCol >= 0 ? (cols[locationCol] || null) : null,
        description: descCol >= 0 ? (cols[descCol] || null) : null,
        source: sourceName, createdAt: new Date().toISOString(),
      });
    }
    return events;
  };

  const parseJSON = (text, sourceName, cat) => {
    try {
      let data = JSON.parse(text);
      if (!Array.isArray(data)) {
        // Try to find an array in common wrapper keys
        for (const key of ["events", "items", "data", "results", "entries", "calendar"]) {
          if (data[key] && Array.isArray(data[key])) { data = data[key]; break; }
        }
      }
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        id: generateUID(),
        title: item.title || item.summary || item.name || item.subject || item.event || "Untitled",
        category: cat,
        startDate: smartParseDate(item.start || item.startDate || item.start_date || item.date || item.when || item.dtstart) || null,
        endDate: smartParseDate(item.end || item.endDate || item.end_date || item.dtend) || null,
        location: item.location || item.place || item.venue || item.where || null,
        description: item.description || item.details || item.notes || item.body || null,
        source: sourceName, createdAt: new Date().toISOString(),
      })).filter((e) => e.title !== "Untitled" || e.startDate);
    } catch { return []; }
  };

  const parseXMLRSS = (text, sourceName, cat) => {
    const events = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      // Try RSS <item> elements
      const items = doc.querySelectorAll("item");
      if (items.length > 0) {
        items.forEach((item) => {
          const title = item.querySelector("title")?.textContent;
          const desc = item.querySelector("description")?.textContent;
          const pubDate = item.querySelector("pubDate")?.textContent;
          const link = item.querySelector("link")?.textContent;
          if (title) {
            events.push({
              id: generateUID(), title, category: cat,
              startDate: pubDate ? smartParseDate(pubDate) : null, endDate: null,
              location: null,
              description: (desc ? desc.replace(/<[^>]*>/g, "").slice(0, 300) : "") + (link ? `\n${link}` : "") || null,
              source: sourceName, createdAt: new Date().toISOString(),
            });
          }
        });
        return events;
      }

      // Try Atom <entry> elements
      const entries = doc.querySelectorAll("entry");
      if (entries.length > 0) {
        entries.forEach((entry) => {
          const title = entry.querySelector("title")?.textContent;
          const summary = entry.querySelector("summary")?.textContent || entry.querySelector("content")?.textContent;
          const published = entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent;
          if (title) {
            events.push({
              id: generateUID(), title, category: cat,
              startDate: published ? smartParseDate(published) : null, endDate: null,
              location: null, description: summary ? summary.replace(/<[^>]*>/g, "").slice(0, 300) : null,
              source: sourceName, createdAt: new Date().toISOString(),
            });
          }
        });
        return events;
      }

      // Try generic <event> elements
      const eventEls = doc.querySelectorAll("event");
      eventEls.forEach((el) => {
        const title = el.querySelector("title,name,summary")?.textContent || el.getAttribute("title");
        const start = el.querySelector("start,date,when")?.textContent || el.getAttribute("start");
        if (title) {
          events.push({
            id: generateUID(), title, category: cat,
            startDate: start ? smartParseDate(start) : null, endDate: null,
            location: el.querySelector("location,place,venue")?.textContent || null,
            description: el.querySelector("description,details,notes")?.textContent || null,
            source: sourceName, createdAt: new Date().toISOString(),
          });
        }
      });
    } catch (e) { console.error("XML parse error:", e); }
    return events;
  };

  // ---- AUTO-DETECT FORMAT ----
  const detectAndParse = (text, sourceName, cat) => {
    const trimmed = text.trim();
    // ICS
    if (trimmed.includes("BEGIN:VCALENDAR") || trimmed.includes("BEGIN:VEVENT")) {
      return { events: parseICS(trimmed, sourceName, cat), format: "iCalendar (.ics)" };
    }
    // JSON
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const events = parseJSON(trimmed, sourceName, cat);
      if (events.length > 0) return { events, format: "JSON" };
    }
    // XML / RSS / Atom
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<rss") || trimmed.startsWith("<feed") || trimmed.startsWith("<events")) {
      const events = parseXMLRSS(trimmed, sourceName, cat);
      if (events.length > 0) return { events, format: "XML/RSS" };
    }
    // CSV / TSV
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length >= 2) {
      const events = parseCSV(trimmed, sourceName, cat);
      if (events.length > 0) return { events, format: "CSV" };
    }
    return { events: [], format: null };
  };

  // ---- HANDLERS ----

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const sourceName = name || file.name.replace(/\.[^.]+$/, "");
      const { events, format } = detectAndParse(text, sourceName, resolvedCategory);
      if (events.length > 0) {
        setFileEvents(events);
        setMessage(`📄 Found ${events.length} events (detected ${format}) in ${file.name}`);
      } else {
        setMessage("⚠️ Couldn't find events in this file. Supported: .ics, .csv, .tsv, .json, .xml, .rss");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportFile = () => {
    if (fileEvents) {
      onImport(fileEvents, name || "Imported");
      setMessage(`✅ Imported ${fileEvents.length} events!`);
      setFileEvents(null);
    }
  };

  const handleSubscribeURL = () => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setMessage(null);
    // Use a CORS proxy for fetching external calendar URLs
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url.trim())}`;
    fetch(proxyUrl)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((text) => {
        const sourceName = name || new URL(url.trim()).hostname;
        const { events, format } = detectAndParse(text, sourceName, resolvedCategory);
        if (events.length > 0) {
          onImport(events, sourceName);
          // Save feed for future re-import
          const feed = { name: name || sourceName, url: url.trim(), category: resolvedCategory, addedAt: new Date().toISOString() };
          const updated = [...savedFeeds.filter((f) => f.url !== feed.url), feed];
          setSavedFeeds(updated);
          try { localStorage.setItem("event-staging-feeds", JSON.stringify(updated)); } catch {}
          setMessage(`✅ Imported ${events.length} events (${format}) from ${sourceName}`);
          setUrl("");
        } else {
          setMessage("⚠️ Couldn't parse events from that URL. Try a direct .ics, .csv, .json, or RSS feed link.");
        }
        setUrlLoading(false);
      })
      .catch((err) => {
        setMessage(`⚠️ Failed to fetch: ${err.message}. Check the URL or try downloading the file and uploading it instead.`);
        setUrlLoading(false);
      });
  };

  const handleRefreshFeed = (feed) => {
    setUrl(feed.url);
    setName(feed.name);
    setCategory(feed.category || "Sports");
    setActiveTab("url");
  };

  const handleRemoveFeed = (feedUrl) => {
    const updated = savedFeeds.filter((f) => f.url !== feedUrl);
    setSavedFeeds(updated);
    try { localStorage.setItem("event-staging-feeds", JSON.stringify(updated)); } catch {}
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) return;
    const sourceName = name || "Pasted";
    const { events, format } = detectAndParse(pasteText, sourceName, resolvedCategory);
    if (events.length > 0) {
      onImport(events, sourceName);
      setMessage(`✅ Imported ${events.length} events (${format})`);
      setPasteText("");
    } else {
      setMessage("⚠️ Couldn't detect events. Try iCal, CSV, JSON, or XML/RSS format.");
    }
  };

  const handleQuickImport = (feed) => {
    setImporting(true);
    setTimeout(() => {
      const events = generateDemoSchedule(feed.name, feed.icon, resolvedCategory);
      onImport(events, feed.name);
      setMessage(`✅ Imported ${events.length} events for ${feed.name}`);
      setImporting(false);
    }, 600);
  };

  const generateDemoSchedule = (teamName, icon, cat) => {
    const events = [];
    const year = new Date().getFullYear();
    let startMonth, endMonth, gamesPerMonth;
    if (teamName.includes("Phillies")) { startMonth = 2; endMonth = 9; gamesPerMonth = 14; }
    else if (teamName.includes("Eagles")) { startMonth = 8; endMonth = 1; gamesPerMonth = 4; }
    else if (teamName.includes("76ers")) { startMonth = 9; endMonth = 3; gamesPerMonth = 10; }
    else if (teamName.includes("Flyers")) { startMonth = 9; endMonth = 3; gamesPerMonth = 10; }
    else if (teamName.includes("Holidays")) {
      const holidays = [
        { m: 0, d: 1, t: "New Year's Day" }, { m: 0, d: 20, t: "MLK Jr. Day" },
        { m: 1, d: 17, t: "Presidents' Day" }, { m: 4, d: 26, t: "Memorial Day" },
        { m: 5, d: 19, t: "Juneteenth" }, { m: 6, d: 4, t: "Independence Day" },
        { m: 8, d: 1, t: "Labor Day" }, { m: 9, d: 13, t: "Columbus Day" },
        { m: 10, d: 11, t: "Veterans Day" }, { m: 10, d: 27, t: "Thanksgiving" },
        { m: 11, d: 25, t: "Christmas Day" },
      ];
      holidays.forEach((h) => {
        const start = new Date(year, h.m, h.d, 0, 0);
        events.push({
          id: generateUID(), title: `🇺🇸 ${h.t}`, category: cat,
          startDate: start.toISOString(), endDate: new Date(start.getTime() + 86400000).toISOString(),
          location: null, description: "Federal holiday", source: teamName, createdAt: new Date().toISOString(),
        });
      });
      return events;
    }
    else { startMonth = 0; endMonth = 11; gamesPerMonth = 4; }
    const opponents = ["vs Braves", "vs Mets", "@ Nationals", "vs Marlins", "@ Cubs", "vs Dodgers", "@ Giants", "vs Cardinals",
      "@ Brewers", "vs Padres", "@ Reds", "vs Pirates", "@ Astros", "vs Red Sox", "@ Yankees", "vs Rays"];
    let month = startMonth, safety = 0;
    while (safety++ < 30) {
      const m = month % 12, y = month >= 12 ? year + 1 : year;
      for (let g = 0; g < gamesPerMonth; g++) {
        const day = Math.min(1 + Math.floor((28 / gamesPerMonth) * g) + Math.floor(Math.random() * 2), 28);
        const hour = Math.random() > 0.3 ? 19 : 13;
        const min = hour === 19 ? (Math.random() > 0.5 ? 5 : 10) : 5;
        const startDate = new Date(y, m, day, hour, min);
        const endDate = new Date(startDate.getTime() + 3 * 3600000);
        const opp = opponents[Math.floor(Math.random() * opponents.length)];
        events.push({
          id: generateUID(), title: `${icon} ${teamName.split(" ").pop()} ${opp}`,
          category: cat, startDate: startDate.toISOString(), endDate: endDate.toISOString(),
          location: opp.startsWith("@") ? "Away" : "Home", description: `${teamName} game`,
          source: teamName, createdAt: new Date().toISOString(),
        });
      }
      if (m === endMonth) break;
      month++;
    }
    return events;
  };

  // ---- STYLES ----
  const inputStyle = {
    width: "100%", padding: "9px 14px", borderRadius: "10px", border: "1.5px solid #d0d0d8",
    fontSize: "13px", fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#fafafa", boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
    color: "#888", display: "block", marginBottom: "6px", fontFamily: "'DM Sans', sans-serif",
  };
  const tabStyle = (isActive) => ({
    padding: "8px 16px", borderRadius: "8px", border: "none",
    background: isActive ? "#1a1a2e" : "transparent", color: isActive ? "#fff" : "#777",
    fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "560px", maxHeight: "88vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#1a1a2e" }}>Import Calendar</h2>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#888", fontFamily: "'DM Sans', sans-serif" }}>
          Supports .ics, .csv, .tsv, .json, XML/RSS, Atom feeds, and subscribable calendar URLs.
        </p>

        {message && (
          <div style={{ padding: "12px 16px", borderRadius: "10px", background: message.startsWith("✅") ? "#f0f9f0" : message.startsWith("⚠") ? "#fef8e6" : "#f0f4ff", marginBottom: "14px", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", color: "#333" }}>
            {message}
          </div>
        )}

        {/* Name & Category */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle}>Calendar Name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phillies, Work, Gym..." />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label style={labelStyle}>Category</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(allCategories || INITIAL_CATEGORIES).map((c) => (
                <button key={c} onClick={() => { setCategory(c); setUseCustomCat(false); }} style={{
                  padding: "6px 12px", borderRadius: "100px",
                  border: !useCustomCat && category === c ? "2px solid #1a1a2e" : "1.5px solid #d0d0d8",
                  background: !useCustomCat && category === c ? "#1a1a2e" : "transparent",
                  color: !useCustomCat && category === c ? "#fff" : "#555",
                  fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{c}</button>
              ))}
              <button onClick={() => setUseCustomCat(true)} style={{
                padding: "6px 12px", borderRadius: "100px",
                border: useCustomCat ? "2px solid #1a1a2e" : "1.5px dashed #d0d0d8",
                background: useCustomCat ? "#1a1a2e" : "transparent",
                color: useCustomCat ? "#fff" : "#999",
                fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>+ New</button>
            </div>
            {useCustomCat && (
              <input style={{ ...inputStyle, marginTop: "6px", maxWidth: "180px" }} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category..." autoFocus />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#f0f0f2", borderRadius: "10px", padding: "3px", marginBottom: "16px" }}>
          <button onClick={() => setActiveTab("file")} style={tabStyle(activeTab === "file")}>📁 Upload File</button>
          <button onClick={() => setActiveTab("url")} style={tabStyle(activeTab === "url")}>🔗 Subscribe / URL</button>
          <button onClick={() => setActiveTab("paste")} style={tabStyle(activeTab === "paste")}>📋 Paste</button>
        </div>

        {/* Tab: File Upload */}
        {activeTab === "file" && (
          <div style={{ marginBottom: "20px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#999", fontFamily: "'DM Sans', sans-serif" }}>
              Upload an .ics, .csv, .tsv, .json, or .xml file. Format is auto-detected.
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{
                padding: "10px 20px", borderRadius: "10px", border: "2px dashed #d0d0d8", background: "#fafafa",
                fontSize: "13px", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", color: "#555", fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: "8px", transition: "border-color 0.2s",
              }}>
                📁 Choose file...
                <input type="file" accept=".ics,.csv,.tsv,.json,.xml,.rss,.atom,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
              </label>
              {fileEvents && (
                <button onClick={handleImportFile} style={{
                  padding: "10px 20px", borderRadius: "10px", border: "none", background: "#1a1a2e", color: "#f0efe9",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>Import {fileEvents.length} events</button>
              )}
            </div>
            <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "10px", background: "#f8f8fa", fontSize: "11px", color: "#999", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7 }}>
              <strong style={{ color: "#666" }}>CSV tip:</strong> Include a header row with columns like <code style={{ background: "#eee", padding: "1px 4px", borderRadius: "3px" }}>Title, Start Date, End Date, Location, Description</code>
            </div>
          </div>
        )}

        {/* Tab: URL / Subscribe */}
        {activeTab === "url" && (
          <div style={{ marginBottom: "20px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#999", fontFamily: "'DM Sans', sans-serif" }}>
              Paste a calendar URL (.ics, RSS feed, JSON API, etc). You can re-import saved feeds anytime.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input style={{ ...inputStyle, flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/calendar.ics" onKeyDown={(e) => e.key === "Enter" && handleSubscribeURL()} />
              <button onClick={handleSubscribeURL} disabled={urlLoading || !url.trim()} style={{
                padding: "9px 18px", borderRadius: "10px", border: "none",
                background: url.trim() ? "#1a1a2e" : "#ccc", color: "#f0efe9",
                fontSize: "13px", fontWeight: 600, cursor: url.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
              }}>{urlLoading ? "Fetching..." : "Import"}</button>
            </div>

            {/* Saved feeds */}
            {savedFeeds.length > 0 && (
              <div style={{ marginTop: "14px" }}>
                <label style={labelStyle}>Saved Feeds</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {savedFeeds.map((feed) => (
                    <div key={feed.url} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e8e8ec", background: "#fafafa",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e" }}>{feed.name}</div>
                        <div style={{ fontSize: "11px", color: "#aaa", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feed.url}</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "8px" }}>
                        <button onClick={() => handleRefreshFeed(feed)} style={{
                          padding: "5px 12px", borderRadius: "6px", border: "none", background: "#1a1a2e", color: "#f0efe9",
                          fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>🔄 Refresh</button>
                        <button onClick={() => handleRemoveFeed(feed.url)} style={{
                          padding: "5px 8px", borderRadius: "6px", border: "1px solid #ddd", background: "transparent",
                          color: "#c44", fontSize: "11px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Paste */}
        {activeTab === "paste" && (
          <div style={{ marginBottom: "20px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#999", fontFamily: "'DM Sans', sans-serif" }}>
              Paste calendar data directly — iCal text, CSV rows, JSON array, or RSS/XML. Format is auto-detected.
            </p>
            <textarea
              style={{ ...inputStyle, minHeight: "120px", resize: "vertical", fontFamily: "'DM Mono', 'DM Sans', monospace", fontSize: "12px" }}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Paste your calendar data here...\n\nExamples:\n• iCal: BEGIN:VCALENDAR...\n• CSV: Title, Date, Location\\nGame 1, 2025-04-01, Stadium\n• JSON: [{"title":"Event","date":"2025-04-01"}]`}
            />
            <button onClick={handlePasteImport} disabled={!pasteText.trim()} style={{
              marginTop: "8px", padding: "9px 18px", borderRadius: "10px", border: "none",
              background: pasteText.trim() ? "#1a1a2e" : "#ccc", color: "#f0efe9",
              fontSize: "13px", fontWeight: 600, cursor: pasteText.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
            }}>Parse & Import</button>
          </div>
        )}

        {/* Quick import demos */}
        <div style={{ borderTop: "1px solid #e8e8ec", paddingTop: "16px" }}>
          <label style={labelStyle}>Quick Import (Demo Schedules)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {SAMPLE_FEEDS.map((feed) => (
              <div key={feed.name} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e8e8ec",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{feed.icon}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e" }}>{feed.name}</span>
                  <span style={{ fontSize: "11px", color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>{feed.hint}</span>
                </div>
                <button onClick={() => handleQuickImport(feed)} disabled={importing} style={{
                  padding: "5px 12px", borderRadius: "6px", border: "none", background: "#1a1a2e", color: "#f0efe9",
                  fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{importing ? "..." : "Import"}</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: "10px", border: "1.5px solid #d0d0d8", background: "transparent",
            color: "#555", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ---- MONTHLY CALENDAR ----
function MonthlyCalendar({ events, allCategories, onSelectEvent, onNewEvent }) {
  const [currentMonth, setCurrentMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!e.startDate) return;
      const d = new Date(e.startDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [events, year, month]);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d) => d && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid #e8e8ec", overflow: "hidden" }}>
      {/* Calendar header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 20px", borderBottom: "1.5px solid #e8e8ec",
      }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 10px", color: "#555" }}>‹</button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#1a1a2e" }}>{monthName}</h3>
          <button onClick={goToday} style={{
            padding: "3px 10px", borderRadius: "6px", border: "1px solid #d0d0d8", background: "transparent",
            fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#555",
          }}>Today</button>
        </div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 10px", color: "#555" }}>›</button>
      </div>

      {/* Day names */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0f0f0" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{
            padding: "8px 4px", textAlign: "center", fontSize: "11px", fontWeight: 600,
            color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Sans', sans-serif",
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((day, i) => {
          const dayEvents = day ? (eventsByDay[day] || []) : [];
          const maxShow = 3;
          return (
            <div key={i} onClick={() => day && onNewEvent && onNewEvent(new Date(year, month, day))}
              style={{
                minHeight: "80px", padding: "4px", borderRight: (i + 1) % 7 !== 0 ? "1px solid #f0f0f0" : "none",
                borderBottom: "1px solid #f0f0f0", background: isToday(day) ? "#fafaf5" : day ? "#fff" : "#fafafa",
                cursor: day ? "pointer" : "default", transition: "background 0.15s",
              }}>
              {day && (
                <>
                  <div style={{
                    fontSize: "12px", fontWeight: isToday(day) ? 700 : 500, color: isToday(day) ? "#1a1a2e" : "#666",
                    fontFamily: "'DM Sans', sans-serif", padding: "2px 6px",
                    ...(isToday(day) ? { background: "#1a1a2e", color: "#fff", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center" } : {}),
                  }}>{day}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                    {dayEvents.slice(0, maxShow).map((evt) => {
                      const col = getCategoryColor(evt.category, allCategories);
                      return (
                        <div key={evt.id} onClick={(e) => { e.stopPropagation(); onSelectEvent(evt); }}
                          title={evt.title}
                          style={{
                            fontSize: "10px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                            padding: "2px 5px", borderRadius: "4px", background: col.bg, color: col.text,
                            borderLeft: `3px solid ${col.dot}`, overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", cursor: "pointer", lineHeight: 1.4,
                          }}>
                          {formatTime(evt.startDate) ? formatTime(evt.startDate).replace(":00", "") + " " : ""}{evt.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > maxShow && (
                      <div style={{ fontSize: "10px", color: "#999", fontFamily: "'DM Sans', sans-serif", paddingLeft: "5px" }}>
                        +{dayEvents.length - maxShow} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- MAIN APP ----
export default function EventStagingApp() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [loaded, setLoaded] = useState(false);
  const [filterDated, setFilterDated] = useState("all");
  const [view, setView] = useState("list"); // list or calendar
  const [prefillDate, setPrefillDate] = useState(null);

  useEffect(() => { loadData().then((data) => { if (data) { if (data.events) setEvents(data.events); if (data.categories) setCategories(data.categories); } setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) saveData({ events, categories }); }, [events, categories, loaded]);

  const allCategories = useMemo(() => [...new Set([...categories, ...events.map((e) => e.category)])], [categories, events]);

  const filteredEvents = useMemo(() => events
    .filter((e) => activeCategory === "All" || e.category === activeCategory)
    .filter((e) => { if (filterDated === "dated") return !!e.startDate; if (filterDated === "undated") return !e.startDate; return true; })
    .filter((e) => { if (!search) return true; const s = search.toLowerCase(); return (e.title || "").toLowerCase().includes(s) || (e.location || "").toLowerCase().includes(s) || (e.description || "").toLowerCase().includes(s); })
    .sort((a, b) => {
      if (sortBy === "name") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "created") return new Date(b.createdAt) - new Date(a.createdAt);
      if (!a.startDate && !b.startDate) return 0; if (!a.startDate) return 1; if (!b.startDate) return -1;
      return new Date(a.startDate) - new Date(b.startDate);
    }), [events, activeCategory, filterDated, search, sortBy]);

  const categoryCounts = {};
  events.forEach((e) => { categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1; });

  const handleSave = (event) => {
    setEvents((prev) => { const idx = prev.findIndex((e) => e.id === event.id); if (idx >= 0) { const c = [...prev]; c[idx] = event; return c; } return [...prev, event]; });
    if (!allCategories.includes(event.category)) setCategories((prev) => [...prev, event.category]);
    setShowForm(false); setEditingEvent(null); setPrefillDate(null);
  };

  const handleDelete = (id) => { setEvents((prev) => prev.filter((e) => e.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); };
  const handleImport = (newEvents, sourceName) => { setEvents((prev) => [...prev.filter((e) => e.source !== sourceName), ...newEvents]); };
  const toggleSelect = (id) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const selectAllVisible = () => setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exportSelected = () => { const sel = events.filter((e) => selectedIds.has(e.id)); if (sel.length === 1) downloadICS(sel[0]); else if (sel.length > 1) downloadMultipleICS(sel); };
  const deleteSelected = () => { setEvents((prev) => prev.filter((e) => !selectedIds.has(e.id))); setSelectedIds(new Set()); };

  const handleCalendarNewEvent = (date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T12:00`;
    setPrefillDate(iso);
    setEditingEvent(null);
    setShowForm(true);
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#888" }}>Loading...</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background: "#1a1a2e", padding: "24px 24px 20px", color: "#f0efe9" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.5px" }}>Event Staging</h1>
              <p style={{ margin: "3px 0 0", fontSize: "13px", color: "rgba(240,239,233,0.5)" }}>{events.length} event{events.length !== 1 ? "s" : ""} in your backlog</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => setShowImportModal(true)} style={{
                padding: "8px 16px", borderRadius: "10px", border: "1.5px solid rgba(240,239,233,0.25)", background: "transparent",
                color: "#f0efe9", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>📥 Import Calendar</button>
              <button onClick={() => { setEditingEvent(null); setPrefillDate(null); setShowForm(true); }} style={{
                padding: "8px 18px", borderRadius: "10px", border: "none", background: "#f0efe9",
                color: "#1a1a2e", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>+ New Event</button>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "20px 24px 0" }}>
        {/* View toggle + Categories */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", flexWrap: "wrap", flex: 1 }}>
            <CategoryPill name="All" active={activeCategory === "All"} count={events.length} onClick={() => setActiveCategory("All")} />
            {allCategories.map((c) => (
              <CategoryPill key={c} name={c} active={activeCategory === c} count={categoryCounts[c] || 0}
                color={getCategoryColor(c, allCategories)} onClick={() => setActiveCategory(c)} />
            ))}
          </div>
          <div style={{ display: "flex", background: "#e8e8ec", borderRadius: "10px", padding: "3px", flexShrink: 0 }}>
            {[{ key: "list", label: "☰ List" }, { key: "calendar", label: "📅 Month" }].map((v) => (
              <button key={v.key} onClick={() => setView(v.key)} style={{
                padding: "6px 14px", borderRadius: "8px", border: "none",
                background: view === v.key ? "#fff" : "transparent",
                color: view === v.key ? "#1a1a2e" : "#888",
                fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: view === v.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Calendar View */}
        {view === "calendar" && (
          <div style={{ marginBottom: "24px" }}>
            <MonthlyCalendar
              events={activeCategory === "All" ? events : events.filter((e) => e.category === activeCategory)}
              allCategories={allCategories}
              onSelectEvent={(evt) => { setEditingEvent(evt); setShowForm(true); }}
              onNewEvent={handleCalendarNewEvent}
            />
            {/* Legend */}
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "12px", padding: "0 4px" }}>
              {allCategories.filter((c) => categoryCounts[c] > 0).map((c) => {
                const col = getCategoryColor(c, allCategories);
                return (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontFamily: "'DM Sans', sans-serif", color: "#666" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "3px", background: col.dot, flexShrink: 0 }} />
                    {c}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {view === "list" && (
          <>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", alignItems: "center" }}>
              <input style={{
                flex: "1 1 200px", padding: "9px 14px", borderRadius: "10px", border: "1.5px solid #d0d0d8",
                fontSize: "13px", fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#fff", minWidth: 0,
              }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search events..." />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{
                padding: "9px 14px", borderRadius: "10px", border: "1.5px solid #d0d0d8", fontSize: "13px",
                fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#555", cursor: "pointer",
              }}>
                <option value="date">Sort: Date</option>
                <option value="name">Sort: Name</option>
                <option value="created">Sort: Recent</option>
              </select>
              <select value={filterDated} onChange={(e) => setFilterDated(e.target.value)} style={{
                padding: "9px 14px", borderRadius: "10px", border: "1.5px solid #d0d0d8", fontSize: "13px",
                fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#555", cursor: "pointer",
              }}>
                <option value="all">All events</option>
                <option value="dated">With date</option>
                <option value="undated">No date</option>
              </select>
            </div>

            {selectedIds.size > 0 && (
              <div style={{
                display: "flex", gap: "10px", alignItems: "center", padding: "12px 18px", borderRadius: "12px",
                background: "#1a1a2e", marginBottom: "16px", flexWrap: "wrap",
              }}>
                <span style={{ fontSize: "13px", color: "#f0efe9", fontWeight: 500 }}>{selectedIds.size} selected</span>
                <button onClick={exportSelected} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: "#f0efe9", color: "#1a1a2e", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📅 Export to iCal</button>
                <button onClick={deleteSelected} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(240,239,233,0.3)", background: "transparent", color: "#f0efe9", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>🗑 Delete</button>
                <button onClick={clearSelection} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(240,239,233,0.3)", background: "transparent", color: "#f0efe9", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Clear</button>
              </div>
            )}

            {filteredEvents.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", color: "#999" }}>{filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}</span>
                <button onClick={selectedIds.size === filteredEvents.length ? clearSelection : selectAllVisible} style={{
                  background: "none", border: "none", color: "#1a1a2e", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textDecoration: "underline", textUnderlineOffset: "2px",
                }}>{selectedIds.size === filteredEvents.length ? "Deselect all" : "Select all"}</button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "40px" }}>
              {filteredEvents.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#aaa", fontSize: "14px" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
                  <p style={{ margin: 0, fontWeight: 500 }}>No events here yet</p>
                  <p style={{ margin: "6px 0 0", fontSize: "13px" }}>Create an event or import a calendar to get started</p>
                </div>
              )}
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} color={getCategoryColor(event.category, allCategories)}
                  onExport={downloadICS} onDelete={handleDelete}
                  onEdit={(e) => { setEditingEvent(e); setShowForm(true); }}
                  selected={selectedIds.has(event.id)} onToggleSelect={() => toggleSelect(event.id)} />
              ))}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <EventForm
          event={editingEvent || (prefillDate ? { startDate: prefillDate } : null)}
          categories={categories}
          allCategories={allCategories}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingEvent(null); setPrefillDate(null); }}
          onExportAfterSave={(evt) => downloadICS(evt)}
        />
      )}
      {showImportModal && (
        <ImportCalendarModal onImport={handleImport} onClose={() => setShowImportModal(false)} allCategories={allCategories} />
      )}
    </div>
  );
}
