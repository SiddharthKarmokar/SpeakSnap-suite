const WebSocket = require('ws');
const speechSdk = require('microsoft-cognitiveservices-speech-sdk');
const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_REGION;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'realtime-transcription';
const COLLECTION = 'transcripts';

if (!AZURE_SPEECH_KEY || !AZURE_REGION || !MONGO_URI) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

// MongoDB Setup
let db;
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// REST API
const app = express();
app.use(cors());

app.get('/transcripts', async (req, res) => {
  try {
    const transcripts = await db.collection(COLLECTION)
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json(transcripts);
  } catch (err) {
    console.error("Error fetching transcripts:", err);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

const httpServer = http.createServer(app);
httpServer.listen(5000, () => {
  console.log("✅ REST API server running on http://localhost:5000");
});

// WebSocket
const wsServer = new WebSocket.Server({ port: 8080 });
console.log("✅ WebSocket server running on ws://localhost:8080");

wsServer.on('connection', (socket) => {
  console.log('🔗 Client connected');

  const pushStream = speechSdk.AudioInputStream.createPushStream();
  const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = speechSdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_REGION);
  speechConfig.speechRecognitionLanguage = "en-US";

  const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

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
      } catch (err) {
        console.error("❌ MongoDB insert error:", err);
      }
    }
  };

  recognizer.startContinuousRecognitionAsync(
    () => console.log("🎙️ Recognition started"),
    err => console.error("❌ Recognition start error:", err)
  );

  socket.on('message', (message) => {
    try {
      pushStream.write(message);
    } catch (err) {
      console.error("❌ PushStream write error:", err);
    }
  });

  socket.on('close', () => {
    console.log("❌ Client disconnected");
    recognizer.stopContinuousRecognitionAsync();
    pushStream.close();
  });

  socket.on('error', (err) => {
    console.error("❌ WebSocket error:", err);
  });
});
