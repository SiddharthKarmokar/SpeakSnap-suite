const WebSocket = require('ws');
const speechSdk = require('microsoft-cognitiveservices-speech-sdk');
const { MongoClient } = require('mongodb');
const axios = require('axios');
require('dotenv').config();

const PORT = 8080;
const server = new WebSocket.Server({ port: PORT });
console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);

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

// Connect to MongoDB
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

server.on('connection', (socket) => {
  console.log('📡 Client connected');

  let recognizer;
  let pushStream;
  let initialized = false;

  // Handle initial JSON metadata message
  socket.once('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      const { userId, meetingId } = parsedMessage;

      if (!userId || !meetingId) {
        console.error("❌ Missing userId or meetingId");
        socket.send("Error: Missing userId or meetingId.");
        socket.close();
        return;
      }

      console.log(`👤 User ID: ${userId}, 📅 Meeting ID: ${meetingId}`);

      pushStream = speechSdk.AudioInputStream.createPushStream();
      const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
      const speechConfig = speechSdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_REGION);
      speechConfig.speechRecognitionLanguage = "en-US";

      recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizing = (s, e) => {
        if (e.result.text) {
          socket.send(e.result.text);
        }
      };

      recognizer.recognized = async (s, e) => {
        if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          socket.send(text);
          console.log("🧠 Final transcript:", text);

          try {
            // Save transcript to MongoDB
            await db.collection(COLLECTION).insertOne({ text, userId, meetingId, timestamp: new Date() });

            // Fetch summary from the external API
            try {
              const apiResponse = await axios.post('http://52.23.182.233:8080/api/summary/', {
                text: text,
                userid: userId,
                sessionid: meetingId,
              });

              console.log("📨 API Response:", JSON.stringify(apiResponse.data, null, 2));
              const summary = apiResponse.data.response.summary;
              const explanations = apiResponse.data.response.contextual_explanations || [];

              const responsePayload = {
                summary,
                contextual_explanations: explanations.filter(e => e && e.term && e.explanation)
              };
              socket.send(`Summary:${userId}=${JSON.stringify(responsePayload)}`);

            } catch (apiErr) {
              console.error("❌ Error calling backend API:", apiErr.message);
              socket.send("Error: Failed to fetch summary.");
            }
          } catch (dbErr) {
            console.error("❌ Error writing to MongoDB:", dbErr.message);
          }
    } else if (e.result.reason === speechSdk.ResultReason.NoMatch) {
      console.warn("⚠️ No speech recognized.");
    }
  };

  recognizer.canceled = (s, e) => {
    console.error("🛑 Recognition canceled:", e.errorDetails || e.reason);
    socket.send("Recognition canceled: " + (e.errorDetails || e.reason));
  };

  recognizer.sessionStopped = (s, e) => {
    console.log("📴 Session stopped.");
    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync(
    () => console.log("🎙️ Recognition started"),
    (err) => {
      console.error("❌ Failed to start recognition:", err);
      socket.send("Server error: Failed to start recognition.");
      socket.close();
    }
  );

  // Now handle audio data as binary
  socket.on('message', (audioData) => {
    if (initialized || audioData instanceof Buffer) {
      try {
        pushStream.write(audioData);
      } catch (err) {
        console.error("❌ Error writing to pushStream:", err.message);
      }
    }
  });

  initialized = true;

} catch (err) {
  console.error("❌ Error processing initial message:", err.message);
  socket.send("Error: Initial message must be JSON.");
  socket.close();
}
  });

socket.on('close', () => {
  console.log("❎ Client disconnected");
  try {
    if (recognizer) recognizer.stopContinuousRecognitionAsync();
    if (pushStream) pushStream.close();
  } catch (err) {
    console.error("❌ Error during cleanup:", err.message);
  }
});

socket.on('error', (err) => {
  console.error("⚠️ WebSocket error:", err.message);
});
});
