import React from 'react';

export const Navbar = ({ onMenuClick }) => {
  return (
    <nav className="bg-gray-800 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className='text-xl'>
          Speak<p className='text-yellow-500 inline-block'>Snap</p>
        </div>

        {/* Nav Links */}
        <div className="hidden md:flex gap-6 text-sm font-medium">
          <a href="#" className="rounded-lg text-center p-2 w-20 hover:bg-gray-900">Home</a>
          <button
            onClick={onMenuClick}
            className="rounded-lg text-center p-2 w-20 hover:bg-gray-900"
          >
            Menu
          </button>
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden">
          <button onClick={onMenuClick} className="focus:outline-none">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};
