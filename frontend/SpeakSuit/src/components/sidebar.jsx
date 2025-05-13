import React, { useState } from 'react';
import { X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose, liveTranscript, summaries, technicalTerms }) => {
  const [activeTab, setActiveTab] = useState(null);
  const [selectedExplanation, setSelectedExplanation] = useState(null);

  const renderContent = () => {
    if (activeTab === 'summary') {
      return (
        <div>
          <h3 className="text-sm text-gray-400">🔴 Live Transcript:</h3>
          <p className="mb-4 text-white">{liveTranscript || "Waiting for speech..."}</p>
          {summaries.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm text-gray-400">📝 Past Summaries:</h3>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {summaries.map((summary, i) => (
                  <li key={i} className="bg-gray-800 p-2 rounded text-sm">{summary}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'technical') {
      return technicalTerms.length > 0 ? (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {technicalTerms.map((item, idx) => (
            <li
              key={idx}
              className="bg-gray-800 p-2 rounded text-sm cursor-pointer hover:bg-purple-600"
              onClick={() => setSelectedExplanation(item)}
            >
              {item.term}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">No technical terms found yet.</p>
      );
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

        {selectedExplanation && (
          <div className="absolute bottom-4 left-4 right-4 bg-gray-800 text-white p-4 rounded shadow-md z-50">
            <h4 className="font-bold mb-2">{selectedExplanation.term}</h4>
            <p>{selectedExplanation.explanation}</p>
            <button className="mt-2 text-sm text-purple-400 underline" onClick={() => setSelectedExplanation(null)}>
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
