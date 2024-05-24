const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid"); // Import UUID for unique file names
const admin = require("firebase-admin");
const cors = require("cors"); // Import the cors middleware
require("dotenv").config(); // Load environment variables from .env file

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});
const bucket = admin.storage().bucket();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
app.use(cors());

app.use(express.static("public"));

// Object to store write streams for each client
const clientStreams = {};

io.on("connection", (socket) => {
  console.log("A user connected");

  // Generate a unique identifier for each client
  const clientId = uuidv4();
  const rawFilePath = path.join(__dirname, `audio_${clientId}.raw`);

  socket.on("audio-chunk", (chunk) => {
    // Create a write stream if it doesn't exist for this client
    if (!clientStreams[clientId]) {
      clientStreams[clientId] = fs.createWriteStream(rawFilePath, {
        flags: "a",
      });
    }
    // Write the received chunk to the client's file
    clientStreams[clientId].write(Buffer.from(chunk));
  });

  const uploadToFirebase = async (filePath, destFileName) => {
    try {
      await bucket.upload(filePath, {
        destination: destFileName,
        metadata: {
          contentType: "application/octet-stream", // Set content type for raw files
        },
      });
      console.log(`File ${destFileName} uploaded to Firebase Storage.`);
      // Delete the local raw file after upload
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Error deleting local file ${filePath}:`, err);
        }
      });
    } catch (error) {
      console.error("Error uploading to Firebase:", error);
    }
  };

  const handleClientDisconnection = () => {
    if (clientStreams[clientId]) {
      clientStreams[clientId].end();
      uploadToFirebase(rawFilePath, `audio_${clientId}.raw`);
      delete clientStreams[clientId]; // Clean up
    }
  };

  socket.on("disconnect", () => {
    console.log("A user disconnected");
    handleClientDisconnection();
  });

  socket.on("stop-recording", () => {
    console.log("Recording stopped by client");
    handleClientDisconnection();
  });
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
