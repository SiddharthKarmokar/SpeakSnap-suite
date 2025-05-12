import React from 'react';
import { X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <div className={`fixed top-0 right-0 h-full w-[20%] bg-gray-900 text-white z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4 flex justify-between items-center border-b border-gray-700">
        <h2 className="text-lg font-semibold">Menu</h2>
        <button onClick={onClose}><X /></button>
      </div>
      <nav className="p-4 flex flex-col gap-4">
        <a href="#" className="hover:text-gray-400">Option 1</a>
        <a href="#" className="hover:text-gray-400">Option 2</a>
      </nav>
    </div>
  );
};

export default Sidebar;
