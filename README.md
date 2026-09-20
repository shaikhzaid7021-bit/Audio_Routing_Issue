# Audio_Routing_Issue

Investigating a Windows audio limitation: routing audio from two windows of the same app (e.g. two Brave windows) to different output devices simultaneously. WASAPI tracks sessions per-process, not per-window, so tools like EarTrumpet/VoiceMeeter can't solve this. Proposing a browser-extension-based fix using setSinkId().

## Note before reading

I'm a newer developer working on this as a side project. The problem writeup and the proposed architecture below were drafted with the help of an AI assistant (Claude) — I'm sharing this openly rather than passing it off as fully my own analysis. I've reasoned through the core problem myself and want to validate it with people who know Windows audio / Chromium internals better than I do before I start building.

## 1) The Problem

**Title:** Is there any way to route audio from two separate windows of the same app (e.g. two Brave windows) to two different output devices simultaneously?

**Body:**

I'm trying to solve an audio routing problem on Windows 11 that I don't think has a real solution yet, and I wanted to sanity-check that before I go build something.

**The problem:** Windows' built-in per-app audio routing (Settings → Sound → Volume Mixer) and third-party tools like EarTrumpet, Audio Router, and VoiceMeeter all route audio at the process level — they let you send one application's audio to a specific output device.

That breaks down when the audio you want to split doesn't come from two different apps, but from two windows of the same app. My specific case: I have two Brave browser windows open, and I want Window A's audio to go to Device 1 (e.g. headphones) and Window B's audio to go to Device 2 (e.g. speakers) — at the same time, both playing simultaneously.

**Why this doesn't work today:** Chromium-based browsers (and most multi-window apps) don't render audio per-window at the OS level. Audio for all windows/tabs goes through a shared "Audio Service" utility process, so to Windows' Core Audio API (WASAPI), it all looks like it's coming from one process/session. WASAPI session tracking is PID-granular, not HWND (window handle) granular — this is actually documented in Chromium's own source comments: a window is just a GUI element, and the process that owns the window isn't always the process that renders the audio for it.

So any tool that routes audio via WASAPI process-session APIs (which is what EarTrumpet/Audio Router/VoiceMeeter all do) physically cannot distinguish between two windows of the same process.

**What I've confirmed does NOT work:**
- Windows Settings > Volume Mixer — only sees "Brave" as one entry, not per-window
- EarTrumpet — same limitation, process-level only
- Audio Router — same limitation
- Launching Brave with `--user-data-dir` to force separate processes — this does work (each instance becomes routable separately) but it's a workaround, not a real per-window solution, and it fragments your browser profile/session.

**What I think might work (haven't built it yet):** Chromium supports `HTMLMediaElement.setSinkId()` (and there's precedent — a Chrome extension called "AuRo" already does per-tab audio device routing this way by patching the `.play()` method on media elements and calling `setSinkId()`). This operates at the web-content layer instead of the OS layer, so it could plausibly be extended to route per-window/per-tab, entirely inside the browser, without touching WASAPI at all.

Caveat: `setSinkId()` only works on `<audio>`/`<video>` elements — it's not implemented for the Web Audio API's `AudioContext` in Chromium yet (Firefox has it, Chromium doesn't), so anything using raw Web Audio API (some games, some web-based DAWs) wouldn't be covered.

**Open questions:**
1. Is there an existing tool that actually does real per-window (not per-process) audio routing on Windows?
2. Has anyone tried building/using a browser extension for this specific use case (two windows of the same browser, different output devices, playing simultaneously)?
3. Is there a lower-level approach not considered here — e.g. some undocumented Windows audio API that's HWND-aware rather than PID-aware?

## 2) Proposed Architecture

**Approach:** browser-extension-based per-window/per-tab audio routing

Since OS-level (WASAPI) routing can't distinguish windows of the same process, the plan is to solve it one layer up, inside the browser, where each tab/window's media elements are individually addressable in JavaScript.

**Components:**

1. **Content script** (injected into every tab)
   - Monkey-patches `HTMLMediaElement.prototype.play` so any `<audio>`/`<video>` element created on the page gets intercepted
   - Uses a `MutationObserver` to catch elements added dynamically after page load (covers SPAs like YouTube)
   - Calls `element.setSinkId(deviceId)` on each captured element, using a device ID pulled from stored config

2. **Popup UI**
   - Lists available output devices via `navigator.mediaDevices.enumerateDevices()`
   - Lets the user assign a device to the current tab (or window, or domain — still deciding the right granularity)
   - Requires a one-time microphone permission grant, because Chrome only exposes real output device labels/IDs after mic permission is granted (browser privacy restriction, not something that can be avoided)

3. **Background service worker**
   - Persists device assignments (`chrome.storage`)
   - Re-applies the assignment when a tab reloads or when the extension re-injects on navigation

**Why this can give TRUE simultaneous multi-device output** (unlike any OS-level trick): because it never goes through WASAPI's single-session-per-process limitation at all — each media element in each tab picks its own sink independently, entirely in-browser.

**Known limitation:** doesn't cover raw `AudioContext`-based audio (Web Audio API) since Chromium hasn't shipped `AudioContext.setSinkId()` yet — only `<audio>`/`<video>` elements are covered. For a browser-based use case (YouTube, Spotify web, Twitch, etc.) this covers the overwhelming majority of real-world audio.

Prior art: a Chrome extension called **AuRo** already does exactly this patching technique for per-tab routing, which validates the core mechanism works in Chromium/Brave today.

To load the extension: chrome://extensions → enable Developer mode → "Load unpacked" → select this repository's root folder (the one containing manifest.json).

The current version only works for YouTube 
While going through the code, you may find some non-English comments, so please use Google Translate to understand the code better
