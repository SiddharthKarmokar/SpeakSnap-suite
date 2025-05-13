import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../components/navbar";
import Sidebar from "../components/sidebar";

export const Meeting = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showLiveCaption, setShowLiveCaption] = useState(false);

  const jitsiContainerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { meetingId, userName, password } = location.state || {};

  useEffect(() => {
    if (!meetingId || !userName) {
      navigate("/");
    } else {
      launchJitsi();
      startAudioStreaming();
    }

    return () => {
      if (window.jitsiApi) window.jitsiApi.dispose();
      stopAudioStreaming();
    };
  }, [meetingId, userName]);

  const launchJitsi = () => {
    const domain = "meet.jit.si";
    const options = {
      roomName: meetingId,
      parentNode: jitsiContainerRef.current,
      userInfo: { displayName: userName },
      configOverwrite: { prejoinPageEnabled: false },
      interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false },
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);
    window.jitsiApi = api;

    if (password) {
      api.addEventListener("videoConferenceJoined", () => {
        api.executeCommand("password", password);
      });
    }
  };

  // 🎙️ Audio streaming logic
  let audioContext = null;
  let socket = null;
  let processor = null;
  let input = null;
  let stream = null;
  let hideTimeout = null;

  const convertFloat32ToInt16 = (buffer) => {
    const l = buffer.length;
    const result = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      result[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7FFF;
    }
    return new Uint8Array(result.buffer);
  };

  const startAudioStreaming = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

      input = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      input.connect(processor);
      processor.connect(audioContext.destination);

      socket = new WebSocket("ws://localhost:8080"); // Replace with your server

      socket.onopen = () => console.log("🎙️ Connected to audio server");

      socket.onmessage = (event) => {
        const transcript = event.data;
        setLiveTranscript(transcript);
        setShowLiveCaption(true);

        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => setShowLiveCaption(false), 4000); // Hide after 4s
      };

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = convertFloat32ToInt16(inputData);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(pcmData);
        }
      };
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopAudioStreaming = () => {
    if (processor) processor.disconnect();
    if (input) input.disconnect();
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    if (audioContext) audioContext.close();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 relative">
        <div className={`transition-all duration-300 ${isSidebarOpen ? "w-[80%]" : "w-full"} p-6`}>
          <h1 className="text-2xl font-bold">Jitsi Meeting</h1>
          <div
            id="jitsi-container"
            ref={jitsiContainerRef}
            className="w-full h-[80vh] mt-4 rounded-xl overflow-hidden shadow-md"
          />

          {/* 🟣 Floating Caption */}
          <div
            className={`pointer-events-none absolute bottom-10 left-1/2 transform -translate-x-1/2 px-6 py-3 max-w-[80%] text-center rounded-lg bg-black bg-opacity-70 text-white text-lg font-medium shadow-lg transition-all duration-500 ease-in-out
              ${showLiveCaption ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4"}`}
          >
            {liveTranscript}
          </div>
        </div>

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          liveTranscript={liveTranscript}
        />
      </div>
    </div>
  );
};
