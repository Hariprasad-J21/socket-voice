document.getElementById("start").addEventListener("click", startStreaming);
document.getElementById("stop").addEventListener("click", stopStreaming);

let mediaRecorder;
let socket = io();
let audioChunks = [];

function startStreaming() {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socket.emit("audio-chunk", event.data);
        }
      };
      mediaRecorder.start(50); // Collect 250ms of data at a time
    })
    .catch((error) => {
      console.error("Error accessing media devices.", error);
    });
}

function stopStreaming() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}
