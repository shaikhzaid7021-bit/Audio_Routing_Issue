document.addEventListener("DOMContentLoaded", async () => {
  const deviceSelect = document.getElementById("deviceSelect");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const permBtn = document.getElementById("permBtn");
  const statusDiv = document.getElementById("status");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  async function loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");

      const hasLabels = outputs.some((d) => d.label !== "");

      if (!hasLabels && outputs.length > 0) {
        permBtn.style.display = "block";
      } else {
        permBtn.style.display = "none";
      }

      deviceSelect.innerHTML = "";

      const defaultOpt = document.createElement("option");
      defaultOpt.value = "default";
      defaultOpt.textContent = "Default Audio Output";
      deviceSelect.appendChild(defaultOpt);

      outputs.forEach((device) => {
        if (device.deviceId !== "default") {
          const opt = document.createElement("option");
          opt.value = device.deviceId;
          opt.textContent = device.label || `Device (${device.deviceId.slice(0, 5)}...)`;
          deviceSelect.appendChild(opt);
        }
      });

      if (tab) {
        chrome.storage.local.get(["tabSinks"], (res) => {
          const tabSinks = res.tabSinks || {};
          if (tabSinks[tab.id]) {
            deviceSelect.value = tabSinks[tab.id].deviceId;
          }
        });
      }
    } catch (err) {
      console.error("Device load failed:", err);
    }
  }

  // Open Permission Page in a New Tab
  permBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
  });

  await loadAudioDevices();

  saveBtn.addEventListener("click", () => {
    const selectedDeviceId = deviceSelect.value;
    const selectedLabel = deviceSelect.options[deviceSelect.selectedIndex]?.text || "";

    if (!tab) return;

    chrome.storage.local.get(["tabSinks"], (res) => {
      const tabSinks = res.tabSinks || {};

      if (!selectedDeviceId || selectedDeviceId === "default") {
        delete tabSinks[tab.id];
        chrome.storage.local.set({ tabSinks }, () => {
          chrome.action.setBadgeText({ tabId: tab.id, text: "" });
          chrome.tabs.sendMessage(
            tab.id,
            { action: "audio-router-set-sink", deviceId: "default", label: "Default" },
            () => {
              statusDiv.textContent = "Reset to Default!";
              statusDiv.style.color = "blue";
            }
          );
        });
      } else {
        tabSinks[tab.id] = { deviceId: selectedDeviceId, label: selectedLabel };
        chrome.storage.local.set({ tabSinks }, () => {
          chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
          chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#4CAF50" });

          chrome.tabs.sendMessage(
            tab.id,
            { action: "audio-router-set-sink", deviceId: selectedDeviceId, label: selectedLabel },
            () => {
              statusDiv.textContent = "Saved & Applied!";
              statusDiv.style.color = "green";
            }
          );
        });
      }
    });
  });

  resetBtn.addEventListener("click", () => {
    if (!tab) return;

    chrome.storage.local.get(["tabSinks"], (res) => {
      const tabSinks = res.tabSinks || {};
      delete tabSinks[tab.id];

      chrome.storage.local.set({ tabSinks }, () => {
        deviceSelect.value = "default";
        chrome.action.setBadgeText({ tabId: tab.id, text: "" });
        chrome.tabs.sendMessage(
          tab.id,
          { action: "audio-router-set-sink", deviceId: "default", label: "Default" },
          () => {
            statusDiv.textContent = "Reset to Default!";
            statusDiv.style.color = "blue";
          }
        );
      });
    });
  });
});