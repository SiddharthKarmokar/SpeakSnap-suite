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
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

let db;
const meetingClients = {};

MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

server.on('connection', (socket) => {
  console.log('📡 Client connected');

  let recognizer, pushStream;
  let meetingId = null;
  let userId = null;

  socket.once('message', async (message) => {
    try {
      const { meetingId: mId, userId: uId } = JSON.parse(message);
      meetingId = mId;
      userId = uId;

      if (!meetingId || !userId) {
        socket.send("Error: Missing userId or meetingId.");
        socket.close();
        return;
      }

      console.log(`👤 ${userId} joined meeting ${meetingId}`);

      meetingClients[meetingId] = meetingClients[meetingId] || [];
      meetingClients[meetingId].push(socket);

      // Send past summaries
      const pastSummaries = await db.collection(COLLECTION)
        .find({ meetingId, summary: { $exists: true } })
        .sort({ timestamp: 1 })
        .toArray();

      for (const doc of pastSummaries) {
        const { userId: senderId, summary, contextual_explanations = [] } = doc;
        const filtered = contextual_explanations.filter(e => e?.term && e?.explanation);

        socket.send(`Summary:${senderId}=${JSON.stringify({ summary, contextual_explanations: filtered })}`);
      }

      pushStream = speechSdk.AudioInputStream.createPushStream();
      const audioConfig = speechSdk.AudioConfig.fromStreamInput(pushStream);
      const speechConfig = speechSdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_REGION);
      speechConfig.speechRecognitionLanguage = "en-US";
      recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizing = (_, e) => {
        if (e.result.text) socket.send(e.result.text);
      };

      recognizer.recognized = async (_, e) => {
        if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          socket.send(text);
          console.log("🧠 Final:", text);

          try {
            await db.collection(COLLECTION).insertOne({ text, userId, meetingId, timestamp: new Date() });

            const response = await axios.post('http://52.23.182.233:8080/api/summary/', {
              text,
              userid: userId,
              sessionid: meetingId
            });

            const { summary, contextual_explanations = [] } = response.data.response;
            const filtered = contextual_explanations.filter(e => e?.term && e?.explanation);
            console.log('api response is ',response.data);
            await db.collection(COLLECTION).insertOne({
              meetingId,
              userId,
              summary,
              contextual_explanations: filtered,
              timestamp: new Date()
            });

            const payload = `Summary:${userId}=${JSON.stringify({ summary, contextual_explanations: filtered })}`;
            meetingClients[meetingId]?.forEach(client => client.send(payload));
          } catch (err) {
            console.error("❌ Summary/API error:", err.message);
            socket.send("Error processing summary.");
          }
        }
      };

      recognizer.startContinuousRecognitionAsync(
        () => console.log("🎙️ Recognition started"),
        err => {
          console.error("❌ Start failed:", err);
          socket.send("Server error: recognition failed.");
          socket.close();
        }
      );
    } catch (err) {
      console.error("❌ Init error:", err.message);
      socket.send("Error: Initial message must be valid JSON.");
      socket.close();
    }
  });

  socket.on('message', (audioData) => {
    if (audioData instanceof Buffer && pushStream) {
      pushStream.write(audioData);
    }
  });

  socket.on('close', () => {
    console.log("❎ Client disconnected");
    if (recognizer) recognizer.stopContinuousRecognitionAsync();
    if (pushStream) pushStream.close();

    if (meetingId) {
      meetingClients[meetingId] = meetingClients[meetingId]?.filter(c => c !== socket);
    }
  });

  socket.on('error', (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
});
