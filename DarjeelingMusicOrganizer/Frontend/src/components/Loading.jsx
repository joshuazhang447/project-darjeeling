import React from 'react';

const Loading = ({ message = "Loading..." }) => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f0f3e6] no-drag select-none">
            <div className="absolute inset-0 pointer-events-none opacity-50"
                style={{ backgroundImage: 'radial-gradient(#d4cdb6 2px, transparent 2px)', backgroundSize: '24px 24px' }}>
            </div>
            <div className="relative">
                <div className="w-20 h-20 bg-[#fffefb] rounded-3xl shadow-[0_20px_40px_-10px_rgba(92,75,55,0.15)] flex items-center justify-center border-4 border-white relative z-10 animate-bounce-gentle">
                    <i className="fa-solid fa-leaf text-4xl text-[#eebb4d]"></i>
                </div>

                {/* Glow/Shadow pulse */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[#eebb4d] rounded-full opacity-20 animate-pulse"></div>
            </div>

            {/* Text */}
            <div className="mt-6 text-[#5c4b37] font-bold text-lg tracking-wide opacity-80 animate-pulse">
                {message}
            </div>
        </div>
    );
};

export default Loading;
