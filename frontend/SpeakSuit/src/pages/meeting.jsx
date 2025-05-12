import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "../components/navbar";
import Sidebar from "../components/sidebar";

export const Meeting = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const jitsiContainerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { meetingId, userName, password } = location.state || {};

  useEffect(() => {
    if (!meetingId || !userName) {
      navigate("/");
    } else {
      launchJitsi();
    }

    return () => {
      // Cleanup the Jitsi Meet iframe on component unmount
      if (window.jitsiApi) {
        window.jitsiApi.dispose();
      }
    };
  }, [meetingId, userName]);

  const launchJitsi = () => {
    const domain = "meet.jit.si";
    const options = {
      roomName: meetingId,
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: userName
      },
      configOverwrite: {
        prejoinPageEnabled: false
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false
      }
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);
    window.jitsiApi = api;

    if (password) {
      api.addEventListener("videoConferenceJoined", () => {
        api.executeCommand("password", password);
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1">
        <div className={`transition-all duration-300 ${isSidebarOpen ? "w-[80%]" : "w-full"} p-6`}>
          <h1 className="text-2xl font-bold">Jitsi Meeting</h1>
          <div
            id="jitsi-container"
            ref={jitsiContainerRef}
            className="w-full h-[80vh] mt-4 rounded-xl overflow-hidden shadow-md"
          />
        </div>
        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
    </div>
  );
};
