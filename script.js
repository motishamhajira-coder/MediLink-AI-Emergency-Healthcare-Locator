/**
 * MediLink — Nearby Emergency Services Locator
 * Modular vanilla JS: geolocation, Leaflet map, hospital data, filters, list UI
 */

/* ==========================================================================
   Configuration & sample hospital data
   Coordinates cluster around central Delhi for demo; distances are computed
   from the user's live position wherever they are in the world.
   ========================================================================== */

const CONFIG = {
  map: {
    defaultZoom: 14,
    maxZoom: 18,
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  geolocation: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  },
};

/**
 * Sample hospitals — at least 5 entries with lat/lng and facility flags.
 * facilities keys: icu | blood_bank | emergency_care
 * isEmergency: true → red marker on map
 */
const HOSPITALS = [
  {
    id: "h1",
    name: "Welfare Hospital Bhatkal",
    address: "Bhatkal, Karnataka 581301",
    lat: 13.9885,
    lng: 74.5536,
    phone: "+91-9880000000",
    facilities: ["icu", "blood_bank", "emergency_care"],
    isEmergency: true,
  },
  {
    id: "h3",
    name: "Government Hospital Bhatkal",
    address: "Bhatkal, Karnataka 581301",
    lat: 13.9974,
    lng: 74.5542,
    phone: "+91-9880000000",
    facilities: ["icu", "blood_bank", "emergency_care"],
    isEmergency: true,
  },
  {
    id: "h5",
    name: "Lifecare Hospital Bhatkal",
    address: "Bhatkal, Karnataka 581301",
    lat: 13.9980,
    lng: 74.5547,
    phone: "+91-9880000000",
    facilities: ["icu", "blood_bank", "emergency_care"],
    isEmergency: true,
  },
  {
    id: "h2",
    name: "Shamsnoor Health Care Bhatkal",
    address: "Shamsnoor Health Care Bhatkal, Karnataka 581301",
    lat: 13.9912,
    lng: 74.5518,
    phone: "+91-9880000000",
    facilities: ["icu", "blood_bank", "emergency_care"],
    isEmergency: true,
  },
  {
    id: "h4",
    name: "Nishath Nursing Home",
    address: "NH-66, Bhatkal, Karnataka 581301",
    lat: 13.9948,
    lng: 74.5561,
    phone: "+91-9880000000",
    facilities: ["blood_bank", "emergency_care"],
    isEmergency: true,
  },
  {
    id: "h6",
    name: "RNS Hospital  Murdeshwar Karnataka",
    address: "Murdeshwar, Karnataka 581301",
    lat: 13.9861,
    lng: 74.5583,
    phone: "+91-9880000000",
    facilities: ["icu", "blood_bank", "emergency_care"],
    isEmergency: true,
  },
];

const FACILITY_LABELS = {
  icu: "ICU Available",
  blood_bank: "Blood Bank",
  emergency_care: "Emergency Care",
};

/* ==========================================================================
   Application state
   ========================================================================== */

const state = {
  userPosition: null,
  map: null,
  userMarker: null,
  hospitalMarkers: new Map(),
  activeFilters: new Set(),
};

/* ==========================================================================
   DOM references
   ========================================================================== */

const dom = {
  loadingPanel: document.getElementById("loading-panel"),
  errorPanel: document.getElementById("error-panel"),
  errorTitle: document.getElementById("error-title"),
  errorMessage: document.getElementById("error-message"),
  retryBtn: document.getElementById("retry-btn"),
  locatorApp: document.getElementById("locator-app"),
  hospitalList: document.getElementById("hospital-list"),
  resultsCount: document.getElementById("results-count"),
  userLocationSummary: document.getElementById("user-location-summary"),
  clearFiltersBtn: document.getElementById("clear-filters"),
  filterInputs: document.querySelectorAll(".filters input[type='checkbox']"),
};

/* ==========================================================================
   UI helpers — loading, error, visibility
   ========================================================================== */

function showLoading() {
  dom.loadingPanel.classList.remove("hidden");
  dom.errorPanel.classList.add("hidden");
  dom.locatorApp.classList.add("hidden");
}

function showError(title, message) {
  dom.loadingPanel.classList.add("hidden");
  dom.errorPanel.classList.remove("hidden");
  dom.locatorApp.classList.add("hidden");
  dom.errorTitle.textContent = title;
  dom.errorMessage.textContent = message;
}

function showLocator() {
  dom.loadingPanel.classList.add("hidden");
  dom.errorPanel.classList.add("hidden");
  dom.locatorApp.classList.remove("hidden");
}

/* ==========================================================================
   Geolocation
   ========================================================================== */

/**
 * Request the user's current position via the Browser Geolocation API.
 * @returns {Promise<GeolocationPosition>}
 */
function requestUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("UNSUPPORTED"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, CONFIG.geolocation);
  });
}

/**
 * Map GeolocationPositionError codes to user-friendly messages.
 * @param {GeolocationPositionError|Error} error
 */
function getGeolocationErrorMessage(error) {
  if (error.message === "UNSUPPORTED") {
    return {
      title: "Geolocation not supported",
      message:
        "Your browser does not support location services. Please use a modern browser such as Chrome, Firefox, or Edge.",
    };
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        title: "Location permission denied",
        message:
          "MediLink needs your location to find nearby emergency services. Please enable location access in your browser settings and try again.",
      };
    case error.POSITION_UNAVAILABLE:
      return {
        title: "Location unavailable",
        message:
          "Your device could not determine a position. Check that GPS or location services are enabled and try again.",
      };
    case error.TIMEOUT:
      return {
        title: "Location request timed out",
        message:
          "Fetching your location took too long. Please check your connection and try again.",
      };
    default:
      return {
        title: "Could not get your location",
        message: error.message || "An unexpected error occurred. Please try again.",
      };
  }
}

/* ==========================================================================
   Distance calculation (Haversine formula)
   ========================================================================== */

/**
 * Calculate distance in kilometres between two lat/lng points.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in km
 */
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Format distance for display.
 * @param {number} km
 */
function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/* ==========================================================================
   Leaflet map & markers
   ========================================================================== */

/**
 * Build a custom div-based marker icon.
 * @param {"user"|"hospital"} type
 * @param {boolean} [isEmergency] — red pin for emergency hospitals
 */
function createMarkerIcon(type, isEmergency = true) {
  const isUser = type === "user";
  const className = isUser
    ? "marker-user"
    : isEmergency
      ? "marker-hospital"
      : "marker-hospital-standard";
  const label = isUser ? "📍" : "+";

  return L.divIcon({
    className: "",
    html: `<div class="marker-icon ${className}" aria-hidden="true"><span>${label}</span></div>`,
    iconSize: isUser ? [36, 36] : [32, 32],
    iconAnchor: isUser ? [18, 36] : [16, 32],
    popupAnchor: [0, -32],
  });
}

/**
 * Initialize the Leaflet map centered on the user.
 * @param {number} lat
 * @param {number} lng
 */
function initMap(lat, lng) {
  if (state.map) {
    state.map.remove();
    state.map = null;
    state.hospitalMarkers.clear();
    state.userMarker = null;
  }

  state.map = L.map("map", {
    center: [lat, lng],
    zoom: CONFIG.map.defaultZoom,
    scrollWheelZoom: true,
  });

  L.tileLayer(CONFIG.map.tileUrl, {
    attribution: CONFIG.map.tileAttribution,
    maxZoom: CONFIG.map.maxZoom,
  }).addTo(state.map);

  state.userMarker = L.marker([lat, lng], {
    icon: createMarkerIcon("user"),
  })
    .addTo(state.map)
    .bindPopup("<strong>You are here</strong><br>Your current location");

  setTimeout(() => state.map.invalidateSize(), 100);
}

/**
 * Build popup HTML for a hospital marker.
 * @param {object} hospital
 * @param {number} distanceKm
 */
function buildPopupContent(hospital, distanceKm) {
  const facilitiesHtml = hospital.facilities
    .map(
      (f) =>
        `<span class="facility-tag${f === "emergency_care" ? " emergency" : ""}">${FACILITY_LABELS[f] || f}</span>`
    )
    .join(" ");

  return `
    <div class="popup-title">${escapeHtml(hospital.name)}</div>
    <div class="popup-row"><strong>Address:</strong> ${escapeHtml(hospital.address)}</div>
    <div class="popup-row"><strong>Distance:</strong> ${formatDistance(distanceKm)}</div>
    <div class="popup-row popup-facilities"><strong>Services:</strong><br>${facilitiesHtml}</div>
    <div class="popup-row"><strong>Contact:</strong> <a href="tel:${hospital.phone.replace(/\s/g, "")}">${escapeHtml(hospital.phone)}</a></div>
  `;
}

/**
 * Add or update a hospital marker on the map.
 * @param {object} hospital
 * @param {number} distanceKm
 */
function upsertHospitalMarker(hospital, distanceKm) {
  const popup = buildPopupContent(hospital, distanceKm);

  if (state.hospitalMarkers.has(hospital.id)) {
    const entry = state.hospitalMarkers.get(hospital.id);
    entry.marker.setPopupContent(popup);
    if (!state.map.hasLayer(entry.marker)) {
      entry.marker.addTo(state.map);
    }
    return;
  }

  const marker = L.marker([hospital.lat, hospital.lng], {
    icon: createMarkerIcon("hospital", hospital.isEmergency),
  })
    .addTo(state.map)
    .bindPopup(popup);

  state.hospitalMarkers.set(hospital.id, { marker, hospital });
}

/**
 * Remove a hospital marker from the map (keeps reference for re-add).
 * @param {string} hospitalId
 */
function hideHospitalMarker(hospitalId) {
  const entry = state.hospitalMarkers.get(hospitalId);
  if (entry && state.map.hasLayer(entry.marker)) {
    state.map.removeLayer(entry.marker);
  }
}

/**
 * Fit map bounds to user + all visible hospitals.
 * @param {Array} visibleHospitals
 */
function fitMapToVisible(visibleHospitals) {
  const points = [L.latLng(state.userPosition.lat, state.userPosition.lng)];

  visibleHospitals.forEach((h) => {
    points.push(L.latLng(h.lat, h.lng));
  });

  if (points.length === 1) {
    state.map.setView(points[0], CONFIG.map.defaultZoom);
    return;
  }

  state.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
}

/* ==========================================================================
   Filtering
   ========================================================================== */

/**
 * Return hospitals that pass all active facility filters.
 * @param {Array} hospitalsWithDistance
 */
function getFilteredHospitals(hospitalsWithDistance) {
  if (state.activeFilters.size === 0) {
    return hospitalsWithDistance;
  }

  return hospitalsWithDistance.filter(({ hospital }) =>
    [...state.activeFilters].every((filter) => hospital.facilities.includes(filter))
  );
}

/**
 * Read active filters from checkbox inputs.
 */
function syncFiltersFromUI() {
  state.activeFilters.clear();
  dom.filterInputs.forEach((input) => {
    if (input.checked) {
      state.activeFilters.add(input.dataset.filter);
    }
  });
}

/* ==========================================================================
   Hospital list (sidebar)
   ========================================================================== */

/**
 * Open Google Maps directions in a new tab.
 * @param {number} destLat
 * @param {number} destLng
 */
function openDirections(destLat, destLng) {
  const { lat, lng } = state.userPosition;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destLat},${destLng}&travelmode=driving`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Render the sidebar hospital list.
 * @param {Array} visibleHospitals — [{ hospital, distanceKm }]
 */
function renderHospitalList(visibleHospitals) {
  dom.resultsCount.textContent = `${visibleHospitals.length} hospital${visibleHospitals.length === 1 ? "" : "s"} found`;

  if (visibleHospitals.length === 0) {
    dom.hospitalList.innerHTML =
      '<li class="empty-list">No hospitals match the selected filters. Try clearing filters.</li>';
    return;
  }

  dom.hospitalList.innerHTML = visibleHospitals
    .map(({ hospital, distanceKm }) => {
      const tags = hospital.facilities
        .map(
          (f) =>
            `<span class="facility-tag${f === "emergency_care" ? " emergency" : ""}">${FACILITY_LABELS[f]}</span>`
        )
        .join("");

      return `
        <li class="hospital-card" data-id="${hospital.id}">
          <div class="hospital-card-header">
            <h3>${escapeHtml(hospital.name)}</h3>
            <span class="distance-badge">${formatDistance(distanceKm)}</span>
          </div>
          <p class="hospital-address">${escapeHtml(hospital.address)}</p>
          <div class="facility-tags">${tags}</div>
          <p class="hospital-contact">
            <a href="tel:${hospital.phone.replace(/\s/g, "")}">${escapeHtml(hospital.phone)}</a>
          </p>
          <button
            type="button"
            class="btn btn-directions"
            data-lat="${hospital.lat}"
            data-lng="${hospital.lng}"
            aria-label="Get directions to ${escapeHtml(hospital.name)}"
          >
            Get Directions
          </button>
        </li>
      `;
    })
    .join("");
}

/* ==========================================================================
   Core render pipeline — sync map markers + list
   ========================================================================== */

/**
 * Enrich hospitals with distance, sort nearest first, apply filters, update UI.
 */
function refreshDisplay() {
  if (!state.userPosition) return;

  const { lat, lng } = state.userPosition;

  const withDistance = HOSPITALS.map((hospital) => ({
    hospital,
    distanceKm: calculateDistanceKm(lat, lng, hospital.lat, hospital.lng),
  })).sort((a, b) => a.distanceKm - b.distanceKm);

  const visible = getFilteredHospitals(withDistance);
  const visibleIds = new Set(visible.map((v) => v.hospital.id));

  HOSPITALS.forEach((hospital) => {
    if (visibleIds.has(hospital.id)) {
      const item = visible.find((v) => v.hospital.id === hospital.id);
      upsertHospitalMarker(hospital, item.distanceKm);
    } else {
      hideHospitalMarker(hospital.id);
    }
  });

  fitMapToVisible(visible.map((v) => v.hospital));
  renderHospitalList(visible);
}

/* ==========================================================================
   Utilities
   ========================================================================== */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================================
   Event bindings
   ========================================================================== */

function bindEvents() {
  dom.retryBtn.addEventListener("click", startApp);

  dom.filterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      syncFiltersFromUI();
      refreshDisplay();
    });
  });

  dom.clearFiltersBtn.addEventListener("click", () => {
    dom.filterInputs.forEach((input) => {
      input.checked = false;
    });
    state.activeFilters.clear();
    refreshDisplay();
  });

  dom.hospitalList.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-directions");
    if (!btn) return;
    openDirections(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng));
  });

  dom.hospitalList.addEventListener("click", (e) => {
    const card = e.target.closest(".hospital-card");
    if (!card || e.target.closest(".btn-directions")) return;

    const id = card.dataset.id;
    const entry = state.hospitalMarkers.get(id);
    if (entry) {
      state.map.setView(entry.marker.getLatLng(), 16);
      entry.marker.openPopup();
    }
  });

  window.addEventListener("resize", () => {
    if (state.map) {
      state.map.invalidateSize();
    }
  });
}

/* ==========================================================================
   App bootstrap
   ========================================================================== */

/**
 * Main entry: request location → init map → render hospitals.
 */
async function startApp() {
  showLoading();

  try {
    const position = await requestUserLocation();
    const { latitude: lat, longitude: lng } = position.coords;

    state.userPosition = { lat, lng };
    showLocator();

    dom.userLocationSummary.textContent = `Your location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    initMap(lat, lng);
    syncFiltersFromUI();
    refreshDisplay();
  } catch (error) {
    const { title, message } = getGeolocationErrorMessage(error);
    showError(title, message);
  }
}

/* ==========================================================================
   Initialize on DOM ready
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  startApp();
});
