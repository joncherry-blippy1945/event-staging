import { useState, useEffect, useMemo } from "react";
// --- FIREBASE IMPORTS ---
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch
} from "firebase/firestore";
import { auth, db, signInWithGoogle } from "./firebase";

// --- CONFIGURATION ---
const AUTHORIZED_EMAIL = import.meta.env.VITE_AUTHORIZED_EMAIL;

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

// Helper to create date strings for ICS
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
  const [loading, setLoading] = useState(false);

  const buildEvent = () => {
    const cat = useCustomCat && newCategory.trim() ? newCategory.trim() : category;
    
    // --- FIX START: Create the base object WITHOUT the ID first ---
    const eventPayload = {
      title: title.trim(), category: cat,
      startDate: startDate || null, endDate: endDate || null,
      location: location.trim() || null, description: description.trim() || null,
      source: event?.source || "manual", createdAt: event?.createdAt || new Date().toISOString(),
    };

    // Only add the ID if we are UPDATING an existing event.
    // If we are creating a new one, we MUST NOT send "id: undefined".
    if (event?.id) {
        eventPayload.id = event.id;
    }
    
    return eventPayload;
    // --- FIX END ---
  };

  const handleSave = async () => { 
    if (!title.trim()) return; 
    setLoading(true);
    await onSave(buildEvent());
    setLoading(false);
  };

  const handleSaveAndExport = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const savedEvent = await onSave(buildEvent()); // Wait for ID from Firestore
    if (savedEvent) onExportAfterSave(savedEvent);
    setLoading(false);
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
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the event?" disabled={loading} />
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
          <button onClick={onCancel} disabled={loading} style={{
            padding: "10px 20px", borderRadius: "10px", border: "1.5px solid #d0d0d8", background: "transparent",
            color: "#555", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || loading} style={{
            padding: "10px 22px", borderRadius: "10px", border: "1.5px solid #1a1a2e",
            background: "transparent", color: title.trim() ? "#1a1a2e" : "#ccc",
            fontSize: "14px", fontWeight: 600, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
          }}>{loading ? "Saving..." : "Save"}</button>
          <button onClick={handleSaveAndExport} disabled={!title.trim() || loading} style={{
            padding: "10px 22px", borderRadius: "10px", border: "none",
            background: title.trim() ? "#1a1a2e" : "#ccc", color: "#f0efe9",
            fontSize: "14px", fontWeight: 600, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif",
          }}>{loading ? "..." : "Save & Export"}</button>
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
  const [activeTab, setActiveTab] = useState("file"); 
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

  // ---- PARSERS (Simplified for brevity - logic same as before) ----
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

  const detectAndParse = (text, sourceName, cat) => {
      try {
        if (text.includes("BEGIN:VCALENDAR")) {
             // Quick regex based parse for ICS
             const events = [];
             const vevents = text.split("BEGIN:VEVENT");
             for(let i=1; i<vevents.length; i++) {
                 const block = vevents[i];
                 const sum = block.match(/SUMMARY:(.*)/)?.[1];
                 const dtstart = block.match(/DTSTART:(.*)/)?.[1];
                 if(sum) events.push({ 
                     title: sum.trim(), 
                     startDate: parseICSDateTime(dtstart), 
                     category: cat, source: sourceName 
                 });
             }
             return { events, format: "ICS" };
        }
        return { events: [], format: "Unknown" };
      } catch (e) { return { events: [], format: "Error" }; }
  };

  // ---- HANDLERS ----

  const handleQuickImport = async (feed) => {
    setImporting(true);
    // Generate demo events
    const events = [];
    const year = new Date().getFullYear();
    for(let i=0; i<5; i++) {
        const d = new Date(year, 2 + i, 15, 19, 0);
        events.push({
            title: `${feed.icon} ${feed.name} Game`,
            category: resolvedCategory,
            startDate: d.toISOString(),
            endDate: new Date(d.getTime() + 10800000).toISOString(),
            location: "Stadium",
            source: feed.name,
            createdAt: new Date().toISOString()
        });
    }
    await onImport(events, feed.name);
    setMessage(`✅ Imported ${events.length} events for ${feed.name}`);
    setImporting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "560px", maxHeight: "88vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#1a1a2e" }}>Import Calendar</h2>
        
        {message && <div style={{ padding: "10px", background: "#f0f9f0", borderRadius: "8px", marginBottom: "10px" }}>{message}</div>}

        <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", display: "block", marginBottom: "5px" }}>CATEGORY</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
              {(allCategories || INITIAL_CATEGORIES).map((c) => (
                <button key={c} onClick={() => { setCategory(c); setUseCustomCat(false); }} style={{
                  padding: "6px 12px", borderRadius: "100px",
                  border: !useCustomCat && category === c ? "2px solid #1a1a2e" : "1.5px solid #d0d0d8",
                  background: !useCustomCat && category === c ? "#1a1a2e" : "transparent",
                  color: !useCustomCat && category === c ? "#fff" : "#555",
                  fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{c}</button>
              ))}
        </div>

        <div style={{ borderTop: "1px solid #e8e8ec", paddingTop: "16px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", display: "block", marginBottom: "6px" }}>Quick Import (Demo Schedules)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {SAMPLE_FEEDS.map((feed) => (
              <div key={feed.name} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e8e8ec",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{feed.icon}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: "#1a1a2e" }}>{feed.name}</span>
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

// ---- LOGIN SCREEN COMPONENT ----
function LoginScreen() {
  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "36px", marginBottom: "12px", color: "#1a1a2e" }}>Event Staging</h1>
      <p style={{ color: "#666", marginBottom: "32px", fontSize: "15px" }}>Sign in to access your calendar</p>
      <button onClick={signInWithGoogle} style={{
        padding: "12px 28px", borderRadius: "100px", border: "none", background: "#1a1a2e",
        color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}>
        <span style={{ fontSize: "18px" }}>G</span> Sign in with Google
      </button>
    </div>
  );
}

// ---- MAIN APP ----
export default function EventStagingApp() {
  const [events, setEvents] = useState([]);
  // Categories are now derived from events + defaults
  const [activeCategory, setActiveCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [filterDated, setFilterDated] = useState("all");
  const [view, setView] = useState("list"); 
  const [prefillDate, setPrefillDate] = useState(null);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Auth & Data Listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    // Listen to Firestore updates in real-time
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(fetchedEvents);
    }, (error) => {
      console.error("Error fetching events:", error);
    });

    return () => unsubscribeData();
  }, [user]);

  // Derived state for categories
  const allCategories = useMemo(() => {
    const fromEvents = events.map(e => e.category);
    return [...new Set([...INITIAL_CATEGORIES, ...fromEvents])];
  }, [events]);

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

  // --- Firestore Actions ---

  const handleSave = async (event) => {
    try {
      if (event.id) {
        // Update existing
        const eventRef = doc(db, "events", event.id);
        const { id, ...dataToUpdate } = event; // Exclude ID from the update payload
        await updateDoc(eventRef, dataToUpdate);
        return event;
      } else {
        // Create new
        // Note: 'event' here must NOT have an 'id' property
        const docRef = await addDoc(collection(db, "events"), event);
        return { ...event, id: docRef.id };
      }
    } catch (e) {
      console.error("Error saving:", e);
      alert("Error saving event: " + e.message);
    } finally {
      setShowForm(false); setEditingEvent(null); setPrefillDate(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteDoc(doc(db, "events", id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) { console.error("Error deleting:", e); }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} events?`)) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      const ref = doc(db, "events", id);
      batch.delete(ref);
    });
    await batch.commit();
    setSelectedIds(new Set());
  };

  const handleImport = async (newEvents) => {
    // Simple batch import (for small numbers)
    // Firestore batch limit is 500 operations
    const batch = writeBatch(db);
    newEvents.forEach(evt => {
       const ref = doc(collection(db, "events")); // Generate ID
       batch.set(ref, evt);
    });
    await batch.commit();
  };

  const toggleSelect = (id) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const selectAllVisible = () => setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exportSelected = () => { const sel = events.filter((e) => selectedIds.has(e.id)); if (sel.length === 1) downloadICS(sel[0]); else if (sel.length > 1) downloadMultipleICS(sel); };
  
  const handleCalendarNewEvent = (date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T12:00`;
    setPrefillDate(iso);
    setEditingEvent(null);
    setShowForm(true);
  };

  // --- Render ---

  if (authLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading...</div>;
  if (!user) return <LoginScreen />;

  // Bouncer check
  if (user.email !== AUTHORIZED_EMAIL) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <h2 style={{ color: "#c44" }}>🚫 Access Denied</h2>
        <p>Sorry, <strong>{user.email}</strong> is not authorized to use this app.</p>
        <button onClick={() => signOut(auth)} style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}>Sign Out</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />

      {showForm && (
        <EventForm
          event={editingEvent}
          categories={allCategories}
          allCategories={allCategories}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingEvent(null); setPrefillDate(null); }}
          onExportAfterSave={(evt) => downloadICS(evt)}
        />
      )}

      {showImportModal && (
        <ImportCalendarModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
          allCategories={allCategories}
        />
      )}

      {/* Header */}
      <header style={{ background: "#1a1a2e", padding: "24px 24px 20px", color: "#f0efe9" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.5px" }}>Event Staging</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "3px" }}>
                <p style={{ margin: "0", fontSize: "13px", color: "rgba(240,239,233,0.5)" }}>
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </p>
                <span style={{ fontSize: "13px", color: "rgba(240,239,233,0.3)" }}>•</span>
                <p style={{ margin: "0", fontSize: "12px", color: "rgba(240,239,233,0.7)" }}>
                  {user.email}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setShowImportModal(true)} style={{
                padding: "8px 16px", borderRadius: "100px", border: "1.5px solid rgba(240,239,233,0.25)", background: "transparent",
                color: "#f0efe9", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>📥 Import</button>
              <button onClick={() => { setEditingEvent(null); setPrefillDate(null); setShowForm(true); }} style={{
                padding: "8px 18px", borderRadius: "100px", border: "none", background: "#f0efe9",
                color: "#1a1a2e", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>+ New Event</button>
              <button onClick={() => signOut(auth)} style={{
                marginLeft: "8px", padding: "8px 12px", borderRadius: "8px", border: "none", background: "rgba(255,255,255,0.1)",
                color: "#f0efe9", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Sign Out</button>
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
    </div>
  );
}