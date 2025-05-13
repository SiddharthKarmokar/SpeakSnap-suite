const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const speechSdk = require('microsoft-cognitiveservices-speech-sdk');
const { MongoClient } = require('mongodb');
const axios = require('axios');
require('dotenv').config();

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_REGION;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'realtime-transcription';
const COLLECTION = 'transcripts';

if (!AZURE_SPEECH_KEY || !AZURE_REGION || !MONGO_URI) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

let db;

// Serve static frontend build
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// MongoDB connection
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

wss.on('connection', (socket) => {
  console.log('📡 WebSocket client connected');

  let recognizer;
  let pushStream;
  let initialized = false;

  socket.once('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      const { userId, meetingId } = parsedMessage;

      if (!userId || !meetingId) {
        socket.send("Error: Missing userId or meetingId");
        socket.close();
        return;
      }

      pushStream = speechSdk.AudioInputStream.createPushStream();
      const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
      const speechConfig = speechSdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_REGION);
      speechConfig.speechRecognitionLanguage = "en-US";

      recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizing = (s, e) => {
        if (e.result.text) socket.send(e.result.text);
      };

      recognizer.recognized = async (s, e) => {
        if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          socket.send(text);

          try {
            await db.collection(COLLECTION).insertOne({ text, userId, meetingId, timestamp: new Date() });

            try {
              const apiResponse = await axios.post('http://52.23.182.233:8080/api/summary/', {
                text: text,
                userid: userId,
                sessionid: meetingId,
              });

              const summary = apiResponse.data.response.summary;
              const explanations = apiResponse.data.response.contextual_explanations || [];

              socket.send(`Summary:${userId}=${JSON.stringify({
                summary,
                contextual_explanations: explanations.filter(e => e.term && e.explanation)
              })}`);

            } catch (apiErr) {
              socket.send("Error: Failed to fetch summary.");
            }
          } catch (dbErr) {
            console.error("❌ DB Error:", dbErr.message);
          }
        }
      };

      recognizer.canceled = (s, e) => {
        socket.send("Recognition canceled: " + (e.errorDetails || e.reason));
      };

      recognizer.sessionStopped = () => {
        recognizer.stopContinuousRecognitionAsync();
      };

      recognizer.startContinuousRecognitionAsync(
        () => console.log("🎙️ Recognition started"),
        (err) => {
          socket.send("Error: Failed to start recognition");
          socket.close();
        }
      );

      socket.on('message', (audioData) => {
        if (initialized || audioData instanceof Buffer) {
          try {
            pushStream.write(audioData);
          } catch (err) {
            console.error("❌ Error writing audio:", err.message);
          }
        }
      });

      initialized = true;

    } catch (err) {
      socket.send("Error: Invalid initial message");
      socket.close();
    }
  });

  socket.on('close', () => {
    try {
      if (recognizer) recognizer.stopContinuousRecognitionAsync();
      if (pushStream) pushStream.close();
    } catch (err) {
      console.error("❌ Cleanup error:", err.message);
    }
  });

  socket.on('error', (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server ready on http://localhost:${PORT}`);
});
