import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Frontpage } from "./pages/frontpage"; 
import { Meeting } from "./pages/meeting";

export const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Frontpage />} />
        <Route path="/meeting" element={<Meeting />} />
      </Routes>
    </Router>
  );
};
export default App;