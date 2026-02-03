import React from 'react';

const NavBar = ({ activeTab, onTabChange }) => {

    const getTabClass = (tabName) => {
        const isActive = activeTab === tabName;
        const baseClass = "px-6 py-2 rounded-t-2xl flex items-center gap-2 cursor-pointer transition-colors duration-200 font-bold border-b-0";
        if (isActive) {
            return `${baseClass} bg-[#fffefb] text-[#eebb4d] shadow-sm z-20`;
        }
        return `${baseClass} bg-[#e6e2d1] hover:bg-[#ece8d9] text-[#8c7b66]`;
    };

    //Future proofing, maybe some custom colors for icon in the future
    const getTabIconClass = (tabName) => {
        return activeTab === tabName ? "" : "";
    };

    const getTabTextClass = (tabName) => {
        return activeTab === tabName ? "font-extrabold text-lg text-[#5c4b37]" : "";
    };

    return (
        <div className="px-6 pt-4 flex items-end gap-2 border-b-4 border-[#fffefb] relative z-10 shrink-0">
            {/* Organize */}
            <button
                onClick={() => onTabChange('organize')}
                className={getTabClass('organize')}
            >
                <i className={`fa-solid fa-box-open ${getTabIconClass('organize')}`}></i>
                <span className={getTabTextClass('organize')}>Organize</span>
            </button>

            {/* Play */}
            <button
                onClick={() => onTabChange('play')}
                className={getTabClass('play')}
            >
                <i className={`fa-solid fa-music ${getTabIconClass('play')}`}></i>
                <span className={getTabTextClass('play')}>Play</span>
            </button>

            {/* Settings */}
            <button
                onClick={() => onTabChange('settings')}
                className={getTabClass('settings')}
            >
                <i className={`fa-solid fa-sliders ${getTabIconClass('settings')}`}></i>
                <span className={getTabTextClass('settings')}>Settings</span>
            </button>
        </div>
    );
};

export default NavBar;
