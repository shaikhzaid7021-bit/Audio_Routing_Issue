// Audio Router - Background Service Worker (Step 5 Final)

// Tab close hone par storage clear karo
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(["tabSinks"], (res) => {
    const tabSinks = res.tabSinks || {};
    if (tabSinks[tabId]) {
      delete tabSinks[tabId];
      chrome.storage.local.set({ tabSinks });
    }
  });
});

// Tab update hone ya switch hone par Badge indicator update karo
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    updateBadge(tabId);
  }
});

function updateBadge(tabId) {
  chrome.storage.local.get(["tabSinks"], (res) => {
    const tabSinks = res.tabSinks || {};
    if (tabSinks[tabId]) {
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#4CAF50" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  });
}

// Tab ID request listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "audio-router-get-tab-id") {
    sendResponse({ tabId: sender.tab ? sender.tab.id : null });
  }
});