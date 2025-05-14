import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../components/navbar";
import Sidebar from "../components/sidebar";

export const Meeting = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showLiveCaption, setShowLiveCaption] = useState(false);
  const [summaries, setSummaries] = useState([]);
  const [technicalTerms, setTechnicalTerms] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [showTermPopup, setShowTermPopup] = useState(false);

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

  let audioContext = null;
  let socket = null;
  let processor = null;
  let input = null;
  let stream = null;
  let hideTimeout = null;
  let termTimeout = null;

  const convertFloat32ToInt16 = (buffer) => {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      result[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7FFF;
    }
    return new Uint8Array(result.buffer);
  };

  const showPopupTerm = (termObj) => {
    setActiveTerm(termObj);
    setShowTermPopup(true);
    if (termTimeout) clearTimeout(termTimeout);
    termTimeout = setTimeout(() => setShowTermPopup(false), 3000);
  };

  const startAudioStreaming = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

      input = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      input.connect(processor);
      processor.connect(audioContext.destination);

      socket = new WebSocket("ws://localhost:8080");

      await new Promise((resolve, reject) => {
        if (socket.readyState === WebSocket.OPEN) return resolve();
        socket.addEventListener("open", resolve);
        socket.addEventListener("error", reject);
      });

      socket.send(JSON.stringify({ userId: userName, meetingId }));

      socket.onmessage = (event) => {
        const message = event.data;

        if (message.startsWith("Summary:")) {
          const [, content] = message.split("Summary:");
          const [user, raw] = content.split("=");
          try {
            const json = JSON.parse(raw);

            if (json.summary) {
              setSummaries((prev) => [...prev, `${user}: ${json.summary}`]);
            }

            if (json.contextual_explanations && json.contextual_explanations.length > 0) {
              const newTerms = json.contextual_explanations.filter(
                (term) => term && term.term && term.explanation
              );
              if (newTerms.length > 0) {
                setTechnicalTerms((prev) => [...prev, ...newTerms]);
                showPopupTerm(newTerms[0]); // show first new term in popup
              }
            }
          } catch (err) {
            console.error("❌ Failed to parse summary content:", err.message);
          }
        } else {
          setLiveTranscript(message);
          setShowLiveCaption(true);
          if (hideTimeout) clearTimeout(hideTimeout);
          hideTimeout = setTimeout(() => setShowLiveCaption(false), 4000);
        }
      };

      processor.onaudioprocess = (e) => {
        const pcmData = convertFloat32ToInt16(e.inputBuffer.getChannelData(0));
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(pcmData);
        }
      };
    } catch (err) {
      console.error("🎤 Mic error:", err);
    }
  };

  const stopAudioStreaming = () => {
    if (processor) processor.disconnect();
    if (input) input.disconnect();
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    if (audioContext) audioContext.close();
  };

  const dismissTermPopup = () => {
    setShowTermPopup(false);
    if (termTimeout) clearTimeout(termTimeout);
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

          {/* 🔴 Live Caption */}
          <div
            className={`pointer-events-none absolute bottom-10 left-1/2 transform -translate-x-1/2 px-6 py-3 max-w-[80%] text-center rounded-lg bg-black bg-opacity-70 text-white text-lg font-medium shadow-lg transition-all duration-500 ease-in-out
              ${showLiveCaption ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4"}`}
          >
            {liveTranscript}
          </div>

          {/* 🧠 Technical Term Popup */}
          <div
            className={`fixed bottom-6 left-6 z-50 w-80 bg-white dark:bg-gray-900 text-black dark:text-white rounded-2xl shadow-xl p-4 border border-gray-300 dark:border-gray-700 transform transition-all duration-500 ease-out
              ${showTermPopup ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"}`}
          >
            {activeTerm && (
              <>
                <div className="font-bold text-lg mb-1">{activeTerm.term}</div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {activeTerm.explanation}
                </div>
                <button
                  className="text-xs text-gray-500 hover:text-red-500 transition-all float-right"
                  onClick={dismissTermPopup}
                >
                  Dismiss ✕
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar with transcript + summaries + terms */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          liveTranscript={liveTranscript}
          summaries={summaries}
          technicalTerms={technicalTerms}
        />
      </div>
    </div>
  );
};