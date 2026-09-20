# Build Steps — Per-Window Audio Router Extension

Each step is self-contained and testable on its own. If you're an AI agent
picking this up mid-project, read this file first, check which steps are
marked DONE, and continue from the next PENDING step. Don't redo completed
steps unless the user explicitly asks for changes to them.

## Step 1 — Extension Skeleton [STATUS: DONE]
Files: manifest.json, content.js, background.js, popup.html, icon16/48/128.png
Goal: extension loads in chrome://extensions (or brave://extensions) with
"Load unpacked" and shows zero errors.
Test: Load unpacked → no red error banner → toolbar icon appears → clicking
it opens the popup showing "Step 1 skeleton" text. Open any webpage's
DevTools console → should see "[Audio Router] content script loaded on: ..."

## Step 2 — Media Element Interceptor [STATUS: DONE]
File to edit: content.js
Goal: detect every <audio>/<video> element on a page (including ones added
dynamically, e.g. YouTube's player) and log it to console, without setting
a sink yet.
Test: open YouTube, play a video, console shows a log confirming the
<video> element was detected (look for "[Audio Router] Detected media
element" and "[Audio Router] Media element started playing").

## Step 3 — Popup Device Picker [STATUS: DONE]
File to edit: popup.html, new file popup.js
Goal: popup lists real output devices via navigator.mediaDevices.
enumerateDevices() (after requesting mic permission once), lets user pick
one, saves choice to chrome.storage.local keyed by tab id.
Test: open popup, see real device names (not just "Speakers"/"Headset"
generic labels — requires mic permission grant first), pick one, reload
popup, previous choice should still be selected.

## Step 4 — Connect Picker to Interceptor [STATUS: DONE]
Files to edit: content.js (read from storage), background.js (relay
messages if needed)
Goal: the device chosen in Step 3's popup actually gets applied via
element.setSinkId() to media elements detected in Step 2.
Test: two tabs playing audio (e.g. two YouTube tabs), assign each to a
different output device via the popup, confirm audio physically comes out
of the correct device for each tab, at the same time.
See detailed Step 4 notes near the end of this file.

## Step 5 — Persistence Across Reload/Navigation [STATUS: DONE]
Files: background.js, content.js
Goal: setting survives tab reload, in-page navigation (SPA route changes),
and browser restart.
Implementation: all tab->device assignments now live in a single
`tabSinks` object in chrome.storage.local (keyed by tabId), cleaned up
automatically via chrome.tabs.onRemoved when a tab closes. content.js
fetches its tab's saved sink on inject (covers reload). A toolbar badge
("ON") shows which tabs currently have routing active.
Test: set a device for a tab, reload the tab, confirm audio still routes
correctly without re-selecting in the popup. Close the tab, confirm the
badge/assignment is cleared (no stale entries accumulate in storage).

## Step 6 — Two-Window Simultaneous Test + Polish [STATUS: PENDING]
Goal: the actual original use case — two separate Brave windows, each
with audio playing, routed to two different physical output devices at
the same time. Clean up console logs, add basic error handling (e.g.
device unplugged mid-playback), write final README usage instructions.
Test: real-world manual test exactly as described in the GitHub repo's
problem writeup.

---

## How to test the extension at any step (Brave)
1. Go to brave://extensions
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the audio-router-extension folder
5. Fix any red errors shown before proceeding to the next build step


## Step 3 — Permission fix
The microphone permission request was moved out of the short-lived action popup and into permission.html, which opens as a normal extension tab. popup.js opens that page when Grant permission is clicked. After permission is granted, close the permission tab and reopen the extension popup to enumerate labeled output devices.


## Step 4 — Actual Audio Routing

The saved per-tab output device is now applied to page media elements using `HTMLMediaElement.setSinkId()`.

- The popup saves `sink_tab_<tabId>` as before.
- The popup sends the selected device to the active tab immediately.
- The content script applies the sink to existing `<audio>`/`<video>` elements.
- Dynamically created media elements are detected by the MutationObserver and routed automatically.
- The `play` event retries routing for players that update their media stream later.
- The background service worker provides the saved sink to content scripts when a page loads.

### Step 4 test
1. Reload the extension in `chrome://extensions`.
2. Open a YouTube tab and start a video.
3. Open Audio Router and select one real output device, e.g. `Speakers (Realtek(R) Audio)`.
4. Click `Save for this tab`.
5. Confirm the status says it was saved/applied.
6. Listen and verify the audio comes from the selected device.
7. Open a second normal tab with another video. Select a different output device, e.g. `Headphones (ZEB-MIST)`.
8. Verify the two tabs can play through different devices simultaneously.

If routing fails, check the page console for `[Audio Router]` messages and the exact `setSinkId()` error.

### Step 4 bug found + fixed: SecurityError on named devices
Symptom: only `"default"` device worked. Any specific named device (e.g.
"Headphones (ZEB-MIST)") failed with:
`SecurityError: No permission to use requested device`

Root cause: `setSinkId(deviceId)` requires mic permission to have been
granted on the SAME ORIGIN as the page calling it. We were only requesting
mic permission inside `permission.html` (a `chrome-extension://` origin),
so the deviceId was authorized for the extension's own origin but not for
e.g. `youtube.com`. Device IDs are origin-scoped for privacy — this is
expected browser behavior, not a bug in our logic.

Fix: content.js now catches `SecurityError` from `setSinkId()`, requests
`getUserMedia({audio:true})` once on the CURRENT PAGE's origin (stops the
stream immediately, never uses it), then retries `setSinkId()` once.
After the first successful retry on a given site, subsequent calls on
that same site work without re-prompting (permission persists per-origin
per Chrome's normal mic permission rules).

Expect one extra mic permission prompt per new website the first time you
route audio on it. This is unavoidable — it's how setSinkId() security
works, not something we can bypass.

### Brave-tested rewrite (v1.0) — regression found + reapplied
A later rewrite of content.js/background.js/popup.js (tested working on
Brave) restructured storage into a single `tabSinks` object and added a
badge indicator + Reset button + tab-close cleanup (covers Step 5).
Good improvements — but this rewrite had DROPPED the SecurityError retry
fix described above: routeElement() had no fallback when setSinkId()
throws SecurityError/NotFoundError on a fresh origin. Reapplied the same
fix pattern (ensurePagePermission() + one retry) into the new
routeElement() function. Confirmed this is the same underlying issue,
not a Brave-specific bug — Brave and Chrome share the same Web Audio API
security model since Brave is Chromium-based.

### Bug found on Brave: HDMI/display-audio device silently stops working after using the extension
Symptom: audio routed correctly to a HDMI/display-audio output device
(e.g. "SONY TV (HD Audio Driver for Display Audio)") the first time, but
after that, ALL audio to that device stopped working — even completely
unrelated to the extension, even after disabling it. Only a full Brave
restart (not just closing the tab) restored the device.
Chrome was not affected by this — only Brave.

Root cause (likely): a getUserMedia() audio stream that isn't released
cleanly can leave the OS audio subsystem holding a lock on the output
device, particularly for HDMI/display-audio devices which are more
prone to exclusive-mode-like behavior on Windows than regular
speakers/headphones. This is a known category of Chromium/OS audio
stack edge case, more visible on Brave's build in this case.

Fix (defense in depth, not guaranteed to be 100% root-caused):
1. In both permission.js and content.js's ensurePagePermission(),
   explicitly set `track.enabled = false` before calling `track.stop()`
   on every track, and null out the stream reference immediately after.
2. Added a check that skips requesting getUserMedia() entirely if
   enumerateDevices() already returns labeled devices for this origin
   (i.e. permission was already granted previously) — this also fixes
   the "have to grant permission again on every refresh" symptom, since
   we no longer create a new stream on every page load once permission
   already exists.

If the HDMI device issue recurs even with this fix, the safest immediate
workaround is: fully restart Brave (not just the tab) to clear the OS
audio lock.
