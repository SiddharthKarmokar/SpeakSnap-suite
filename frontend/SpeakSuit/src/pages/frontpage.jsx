import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for redirection
import 'animate.css';
import '../css/frontpage.css';

export const Frontpage = () => {
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState(""); // Added for user name
  const [darkMode, setDarkMode] = useState(false);
  const [password, setPassword] = useState(""); // State for password
  const [meetingPassword, setMeetingPassword] = useState("");

  const navigate = useNavigate(); // Hook for navigation

  const handleInputChange = (event) => {
    setInput(event.target.value);
  };

  const handleNameChange = (event) => {
    setUserName(event.target.value); // Handle name input
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value); // Handle password input
  };

  const handleSearch = () => {
    // Extract meeting ID if the input is a Jitsi link or use the input directly
    const meetingId = extractMeetingId(input) || input.trim();
    
    if (meetingId && userName) {
      // If password is required (i.e., the URL contains a password)
      const isPasswordProtected = isPasswordProtectedRoom(input);
      
      if (isPasswordProtected) {
        // Ask user for password
        const userPassword = prompt("This meeting is password protected. Please enter the password.");
        if (userPassword) {
          setPassword(userPassword);
          console.log( {meetingId, userName, password});
          navigate("/meeting", { state: { meetingId, userName, password: meetingPassword } });
        } else {
          alert("Password is required to join the meeting.");
        }
      } else {
        // No password needed, just navigate
        navigate("/meeting", { state: { meetingId, userName } });
      }
    } else {
      alert("Please enter a valid meeting ID or link, and your name.");
    }
  };

  const extractMeetingId = (input) => {
    try {
      const url = new URL(input);
      if (url.hostname.includes("meet.jit.si")) {
        return url.pathname.split("/").pop(); // last part is meeting ID
      }
    } catch {
      // Not a URL — treat as meeting ID directly
    }
    return input.trim(); // fallback to direct input
  };

  // Function to check if the room is password-protected (you can adjust the logic as per your needs)
  const isPasswordProtectedRoom = (url) => {
    return url.includes("password="); // Checks if the URL contains a password query param (optional)
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  };

  return (
    <>
      <div className="fixed top-5 right-5 flex items-center space-x-4 z-20">
        <button className="underline text-sm transition-colors duration-300 dark:text-black">
          About Us
        </button>
        <button onClick={toggleDarkMode} className="underline text-sm transition-colors duration-300 dark:text-black">
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
      <div className="flex justify-center items-center h-screen">
        <div className="flex w-full flex-col items-center text-center relative">
          <h1 className="text-6xl font-bold text-blue-600 mb-10 animate__animated animate__pulse animate__infinite animate__slow">
            SpeakSnap
          </h1>

          <input
            type="text"
            className="w-2/5 h-12 px-4 text-lg border-2 border-blue-600 rounded-full mb-6"
            value={input}
            onChange={handleInputChange}
            placeholder="Enter Jitsi Meeting Link"
          />
          <input
            type="text"
            className="w-2/5 h-12 px-4 text-lg border-2 border-blue-600 rounded-full mb-6"
            value={userName}
            onChange={handleNameChange}
            placeholder="Enter Your Name"
          />
          <input
          type="text"
          className="w-2/5 h-12 px-4 text-lg border-2 border-blue-600 rounded-full mb-6"
          value={meetingPassword}
          onChange={(e) => setMeetingPassword(e.target.value)}
          placeholder="Enter Password (if any)"
        />

          <div className="flex justify-center">
            <button
              className="px-6 py-3 text-lg bg-blue-600 text-white rounded-full transition duration-300 hover:bg-blue-700"
              onClick={handleSearch}
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
