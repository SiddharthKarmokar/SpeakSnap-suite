const WebSocket = require('ws');
const speechSdk = require('microsoft-cognitiveservices-speech-sdk');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const PORT = 8080;
const server = new WebSocket.Server({ port: PORT });
console.log(`WebSocket server running on ws://localhost:${PORT}`);

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_REGION;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'realtime-transcription';
const COLLECTION = 'transcripts';

if (!AZURE_SPEECH_KEY || !AZURE_REGION) {
  console.error("Missing AZURE_SPEECH_KEY or AZURE_REGION in .env");
  process.exit(1);
}

let db;

MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

server.on('connection', (socket) => {
  console.log('Client connected');

  const pushStream = speechSdk.AudioInputStream.createPushStream();
  const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = speechSdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_REGION);
  speechConfig.speechRecognitionLanguage = "en-US";

  let recognizer;

  try {
    recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);
  } catch (err) {
    console.error("Error creating Azure SpeechRecognizer:", err);
    socket.send("Server error: Unable to initialize speech recognizer.");
    socket.close();
    return;
  }

  recognizer.recognizing = (s, e) => {
    if (e.result.text) {
      socket.send(e.result.text);
    }
  };

  recognizer.recognized = async (s, e) => {
    if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
      const text = e.result.text;
      socket.send(text);
      try {
        await db.collection(COLLECTION).insertOne({ text, timestamp: new Date() });
      } catch (dbErr) {
        console.error("Error saving to MongoDB:", dbErr);
      }
    } else if (e.result.reason === speechSdk.ResultReason.NoMatch) {
      console.warn("No speech recognized.");
    }
  };

  recognizer.canceled = (s, e) => {
    console.error("Recognition canceled:", e.errorDetails || e.reason);
    socket.send("Recognition canceled: " + (e.errorDetails || e.reason));
  };

  recognizer.sessionStopped = (s, e) => {
    console.log("Session stopped");
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync(
    () => console.log("Recognition started"),
    (err) => {
      console.error("Failed to start recognition:", err);
      socket.send("Server error: Failed to start recognition.");
      socket.close();
    }
  );

  socket.on('message', (message) => {
    try {
      pushStream.write(message);
    } catch (err) {
      console.error("Error writing to pushStream:", err);
    }
  });

  socket.on('error', (err) => {
    console.error("WebSocket error:", err);
  });

  socket.on('close', () => {
    console.log("Client disconnected");
    try {
      recognizer.stopContinuousRecognitionAsync();
      pushStream.close();
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  });
});