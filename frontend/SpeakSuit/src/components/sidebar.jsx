import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose, liveTranscript }) => {
  const [activeTab, setActiveTab] = useState(null);
  const [pastTranscripts, setPastTranscripts] = useState([]);

  useEffect(() => {
    if (activeTab === 'summary') {
      fetch('http://localhost:5000/transcripts')
        .then(res => res.json())
        .then(data => setPastTranscripts(data))
        .catch(err => console.error("Failed to fetch:", err));
    }
  }, [activeTab]);

  const renderContent = () => {
    if (activeTab === 'summary') {
      return (
        <div>
          <h3 className="text-sm text-gray-400">🔴 Live Transcript:</h3>
          <p className="mb-4 text-white">{liveTranscript || "Waiting for speech..."}</p>
          <h3 className="text-sm text-gray-400">📜 Past Transcripts:</h3>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {pastTranscripts.map((item, i) => (
              <li key={i} className="bg-gray-800 p-2 rounded text-sm">
                <p>{item.text}</p>
                <p className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (activeTab === 'technical') {
      return <p>These are technical words extracted from the transcript (Coming soon).</p>;
    }

    return <p className="text-gray-400">Select a tab to view content.</p>;
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black bg-opacity-40 z-40" onClick={onClose} />}

      <div className={`fixed top-0 right-0 h-full w-[20%] bg-gray-900 text-white z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-lg font-semibold">Menu</h2>
          <button onClick={onClose} aria-label="Close sidebar"><X /></button>
        </div>

        <nav className="p-4 flex flex-col gap-4">
          <button className={`text-l p-4 w-2/3 ${activeTab === 'summary' ? 'bg-gray-700' : ''}`} onClick={() => setActiveTab('summary')}>
            Summary
          </button>
          <button className={`text-l p-4 w-2/3 ${activeTab === 'technical' ? 'bg-gray-700' : ''}`} onClick={() => setActiveTab('technical')}>
            Technical Words
          </button>
        </nav>

        <div className="p-4 border-t border-gray-700 h-[60%] overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
