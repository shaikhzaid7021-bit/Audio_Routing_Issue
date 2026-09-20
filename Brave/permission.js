document.getElementById("grantBtn").addEventListener("click", async () => {
  const statusDiv = document.getElementById("status");
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Stop every track explicitly and disable it first. On some HDMI/
    // display-audio output devices, a lingering getUserMedia() stream can
    // hold the OS audio subsystem in a state where other apps/tabs can't
    // route to that device until the browser fully restarts. Disabling
    // before stopping, and stopping every track individually, is the most
    // reliable release pattern.
    stream.getTracks().forEach((track) => {
      track.enabled = false;
      track.stop();
    });
    stream = null;

    statusDiv.style.color = "green";
    statusDiv.textContent = "Permission Granted! You can close this tab now.";

    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (err) {
    statusDiv.style.color = "red";
    statusDiv.textContent = "Permission Denied. Please allow microphone access.";
  } finally {
    // Belt-and-suspenders: if anything above threw after the stream was
    // created, make sure it's still released.
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
});