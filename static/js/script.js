/**
 * SafeRoute AI — Frontend JavaScript
 * Handles: hazard form submission, dynamic list rendering, filters, toast notifications
 * Future: Map integration, real-time updates via WebSocket, geolocation
 */

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let allHazards = [];        // Master list from server
let activeFilter = "All";   // Current filter tab
let selectedHazardType = ""; // Selected type from visual buttons

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initHazardTypePicker();
  initFilterTabs();
  initReportForm();
  loadHazards();

  // Future: initMap(), initWebSocket()
});

// ─────────────────────────────────────────────
// Hazard Type Visual Picker
// ─────────────────────────────────────────────
function initHazardTypePicker() {
  const buttons = document.querySelectorAll(".hazard-type-btn");
  const hiddenInput = document.getElementById("hazard-type-input");

  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Deselect all
      buttons.forEach(b => b.classList.remove("active-water", "active-accident", "active-pothole"));

      // Select clicked
      const type = btn.dataset.type;
      const activeClass = btn.dataset.activeClass;
      btn.classList.add(activeClass);

      selectedHazardType = type;
      if (hiddenInput) hiddenInput.value = type;
    });
  });
}

// ─────────────────────────────────────────────
// Filter Tabs
// ─────────────────────────────────────────────
function initFilterTabs() {
  const tabs = document.querySelectorAll(".filter-tab");
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.filter;
      renderHazards(allHazards);
    });
  });
}

// ─────────────────────────────────────────────
// Load Hazards from API
// ─────────────────────────────────────────────
async function loadHazards() {
  try {
    const res = await fetch("/hazards");
    if (!res.ok) throw new Error("Failed to load");

    const data = await res.json();
    allHazards = data.hazards || [];
    renderHazards(allHazards);
    updateStats(allHazards);

  } catch (err) {
    console.error("Error loading hazards:", err);
  }
}

// ─────────────────────────────────────────────
// Report Form Submission
// ─────────────────────────────────────────────
function initReportForm() {
  const form = document.getElementById("report-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type     = document.getElementById("hazard-type-input")?.value;
    const location = document.getElementById("location")?.value.trim();
    const desc     = document.getElementById("description")?.value.trim();

    // Validate
    if (!type) { showToast("Please select a hazard type.", "error"); return; }
    if (!location) { showToast("Please enter a location.", "error"); return; }
    if (!desc) { showToast("Please add a description.", "error"); return; }

    // Submit button state
    const submitBtn = form.querySelector(".submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner">⏳</span> Reporting...`;
    }

    try {
      const res = await fetch("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, location, description: desc })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      // Prepend new hazard to list
      allHazards.unshift(data.hazard);
      renderHazards(allHazards);
      updateStats(allHazards);

      // Reset form
      form.reset();
      selectedHazardType = "";
      document.querySelectorAll(".hazard-type-btn").forEach(b =>
        b.classList.remove("active-water", "active-accident", "active-pothole")
      );
      if (document.getElementById("hazard-type-input")) {
        document.getElementById("hazard-type-input").value = "";
      }

      showToast("✅ Hazard reported successfully!", "success");

    } catch (err) {
      showToast(err.message || "Something went wrong.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `🚨 Report Hazard`;
      }
    }
  });
}

// ─────────────────────────────────────────────
// Render Hazard Cards
// ─────────────────────────────────────────────
function renderHazards(hazards) {
  const container = document.getElementById("hazards-list");
  if (!container) return;

  // Apply filter
  const filtered = activeFilter === "All"
    ? hazards
    : hazards.filter(h => normalizeType(h.type) === normalizeType(activeFilter));

  // Update count badge
  const badge = document.getElementById("hazard-count");
  if (badge) badge.textContent = `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`;

  // Render
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛣️</div>
        <h3>No hazards reported yet</h3>
        <p>Be the first to report a road hazard in your area.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((h, i) => createHazardCard(h, i)).join("");
}

// ─────────────────────────────────────────────
// Create Single Hazard Card HTML
// ─────────────────────────────────────────────
function createHazardCard(hazard, index) {
  const { type, location, description, timestamp, user } = hazard;
  const { badgeClass, icon } = getTypeStyle(type);
  const initials = user ? user.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  return `
    <div class="hazard-card" style="animation-delay: ${index * 0.04}s">
      <div class="hazard-card-top">
        <span class="hazard-type-badge ${badgeClass}">${icon} ${type}</span>
        <span class="hazard-time">${timestamp}</span>
      </div>
      <div class="hazard-location">${escapeHtml(location)}</div>
      <div class="hazard-desc">${escapeHtml(description)}</div>
      <div class="hazard-footer">
        <div class="hazard-reporter">
          <div class="reporter-avatar">${initials}</div>
          <span>Reported by <strong>${escapeHtml(user || "Anonymous")}</strong></span>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// Update Dashboard Stats
// ─────────────────────────────────────────────
function updateStats(hazards) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl("stat-total",    hazards.length);
  setEl("stat-water",    hazards.filter(h => normalizeType(h.type) === "waterlogging").length);
  setEl("stat-accident", hazards.filter(h => normalizeType(h.type) === "accident").length);
  setEl("stat-pothole",  hazards.filter(h => normalizeType(h.type) === "pothole").length);
}

// ─────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✅" : "⚠️"}</span>
    <span>${message}</span>`;

  container.appendChild(toast);

  // Auto-remove after 3.5s
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─────────────────────────────────────────────
// Utility: Get badge/icon by hazard type
// ─────────────────────────────────────────────
function getTypeStyle(type) {
  const t = normalizeType(type);
  if (t === "waterlogging") return { badgeClass: "badge-water", icon: "🌊" };
  if (t === "accident")     return { badgeClass: "badge-accident", icon: "🚨" };
  if (t === "pothole")      return { badgeClass: "badge-pothole", icon: "🕳️" };
  return { badgeClass: "badge-water", icon: "⚠️" };
}

function normalizeType(type) {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t.includes("water")) return "waterlogging";
  if (t.includes("accident")) return "accident";
  if (t.includes("pothole") || t.includes("road")) return "pothole";
  return t;
}

// ─────────────────────────────────────────────
// Utility: Escape HTML to prevent XSS
// ─────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

/* ─────────────────────────────────────────────
   FUTURE HOOKS (stub for extensibility)
   ─────────────────────────────────────────────
function initMap() {
  // Initialize Google Maps or Leaflet
  // Plot hazard markers from allHazards
}

function initWebSocket() {
  // Connect to Flask-SocketIO
  // Listen for "new_hazard" events and prepend to list
  const socket = io();
  socket.on("new_hazard", (hazard) => {
    allHazards.unshift(hazard);
    renderHazards(allHazards);
    updateStats(allHazards);
    showToast(`New hazard reported: ${hazard.type}`, "success");
  });
}

async function getUserLocation() {
  // HTML5 Geolocation API
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej)
  );
}
───────────────────────────────────────────── */
