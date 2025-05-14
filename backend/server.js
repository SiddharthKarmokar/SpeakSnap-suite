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
const meetingClients = {}; // Store clients by meetingId

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
  let meetingId = null;
  let userId = null;

  socket.once('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      meetingId = parsedMessage.meetingId;
      userId = parsedMessage.userId;

      if (!meetingId || !userId) {
        console.error("❌ Missing userId or meetingId");
        socket.send("Error: Missing userId or meetingId.");
        socket.close();
        return;
      }

      console.log(`👤 User ID: ${userId}, 📅 Meeting ID: ${meetingId}`);

      // Add client to the meeting group
      if (!meetingClients[meetingId]) {
        meetingClients[meetingId] = [];
      }
      meetingClients[meetingId].push(socket);

      // Send historical summaries to this client
      try {
        const previousSummaries = await db.collection(COLLECTION)
          .find({ meetingId, summary: { $exists: true } })
          .sort({ timestamp: 1 })
          .toArray();

        for (const doc of previousSummaries) {
          const filteredExplanations = explanations.filter(e => e && e.term && e.explanation);
          const responsePayload = {
            summary
          };
          if (filteredExplanations.length > 0) {
            responsePayload.contextual_explanations = filteredExplanations;
          }

          socket.send(`Summary:${doc.userId}=${JSON.stringify(responsePayload)}`);
        }
      } catch (err) {
        console.error("❌ Error fetching historical summaries:", err.message);
      }

      // Initialize pushStream and recognizer
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
            // Save raw transcript
            await db.collection(COLLECTION).insertOne({ text, userId, meetingId, timestamp: new Date() });

            // Call backend summary API
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

            // Save summary + explanations to DB
            await db.collection(COLLECTION).insertOne({
              meetingId,
              userId,
              summary,
              contextual_explanations: responsePayload.contextual_explanations,
              timestamp: new Date()
            });

            // Send to all clients including sender
            meetingClients[meetingId].forEach(client => {
              client.send(`Summary:${userId}=${JSON.stringify(responsePayload)}`);
            });
          } catch (err) {
            console.error("❌ Error in API or DB operation:", err.message);
            socket.send("Error: Failed to process summary.");
          }
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
    } catch (err) {
      console.error("❌ Error processing initial message:", err.message);
      socket.send("Error: Initial message must be JSON.");
      socket.close();
    }
  });

  // Handle audio binary data
  socket.on('message', (audioData) => {
    if (audioData instanceof Buffer && pushStream) {
      try {
        pushStream.write(audioData);
      } catch (err) {
        console.error("❌ Error writing to pushStream:", err.message);
      }
    }
  });

  socket.on('close', () => {
    console.log("❎ Client disconnected");
    try {
      if (recognizer) recognizer.stopContinuousRecognitionAsync();
      if (pushStream) pushStream.close();
      if (meetingId && meetingClients[meetingId]) {
        meetingClients[meetingId] = meetingClients[meetingId].filter(client => client !== socket);
      }
    } catch (err) {
      console.error("❌ Error during cleanup:", err.message);
    }
  });

  socket.on('error', (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
});
