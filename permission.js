document.getElementById("grantBtn").addEventListener("click", async () => {
  const statusDiv = document.getElementById("status");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    
    statusDiv.style.color = "green";
    statusDiv.textContent = "Permission Granted! You can close this tab now.";
    
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (err) {
    statusDiv.style.color = "red";
    statusDiv.textContent = "Permission Denied. Please allow microphone access.";
  }
});