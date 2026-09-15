// Audio Router - Content Script

let activeSinkId = null;
let activeDeviceLabel = null;

// Load initial state on page inject
chrome.runtime.sendMessage({ action: "audio-router-get-tab-id" }, (response) => {
  if (chrome.runtime.lastError || !response || !response.tabId) return;
  chrome.storage.local.get(["tabSinks"], (result) => {
    const tabSinks = result.tabSinks || {};
    const saved = tabSinks[response.tabId];
    if (saved) {
      activeSinkId = saved.deviceId;
      activeDeviceLabel = saved.label;
      console.log("[Audio Router] Script ready, loaded:", activeDeviceLabel);
      applyToAll();
    }
  });
});

// Live message listener from Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "audio-router-set-sink") {
    activeSinkId = msg.deviceId;
    activeDeviceLabel = msg.label;
    console.log("[Audio Router] Live update received:", activeDeviceLabel);
    applyToAll();
    sendResponse({ status: "success" });
  }
});

// Match Device Label to local origin ID
async function getLocalDeviceId(targetLabel) {
  if (!targetLabel) return activeSinkId;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const matched = devices.find((d) => d.kind === "audiooutput" && d.label === targetLabel);
    if (matched && matched.deviceId) return matched.deviceId;
  } catch (e) {
    console.warn("[Audio Router] Device lookup warning:", e);
  }
  return activeSinkId;
}

// Route audio/video element
async function routeElement(el) {
  if (!activeDeviceLabel && !activeSinkId) return;
  const targetId = await getLocalDeviceId(activeDeviceLabel);
  if (!targetId) return;

  if (typeof el.setSinkId === "function") {
    try {
      await el.setSinkId(targetId);
      console.log(`[Audio Router] Connected ${el.tagName} to device: ${activeDeviceLabel}`);
    } catch (e) {
      console.error(`[Audio Router] Output binding failed:`, e);
    }
  }
}

function applyToAll() {
  document.querySelectorAll("video, audio").forEach((el) => routeElement(el));
}

// Observe dynamic media additions (YouTube video loads)
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches("video, audio")) attachEvents(node);
        node.querySelectorAll("video, audio").forEach((c) => attachEvents(c));
      }
    }
  }
});

function attachEvents(el) {
  el.addEventListener("play", () => routeElement(el));
  el.addEventListener("playing", () => routeElement(el));
  routeElement(el);
}

if (document.body || document.documentElement) {
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
}