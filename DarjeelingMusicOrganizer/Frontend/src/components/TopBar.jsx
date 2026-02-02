import React from 'react';

const TopBar = () => {
    //Handlers
    const handleMinimize = () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            window.chrome.webview.hostObjects.appBridge.MinimizeWindow();
        }
    };

    const handleClose = () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            window.chrome.webview.hostObjects.appBridge.CloseWindow();
        }
    };

    const handleMouseDown = (e) => {
        //Only drag if left click and not on the buttons
        if (e.button === 0 && window.chrome?.webview?.hostObjects?.appBridge) {
            window.chrome.webview.hostObjects.appBridge.DragWindow();
        }
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            className="fixed top-0 left-0 w-full h-10 flex items-center justify-between px-4 z-[100] select-none bg-[#f0f3e6] border-b-2 border-[#e0e3d6]"
        >
            {/*Left Part: Icon and the title */}
            <div className="flex items-center gap-2 pointer-events-none">
                {/* 
                    TODO!!!!!!!!
                    DON'T FORGET TO CHANGE THE ICON!!!!!!
                 */}
                <i className="fa-solid fa-leaf text-[#eebb4d] text-lg"></i>
                <span className="text-sm font-bold text-[#5c4b37] tracking-wide opacity-80">Darjeeling Music Organizer</span>
            </div>

            {/* Right Part: Minimize and Close buttons */}
            <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
                <button
                    onClick={handleMinimize}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#e0e3d6] transition-colors text-[#9c8b77] hover:text-[#5c4b37]"
                    title="Minimize"
                >
                    <i className="fa-solid fa-minus"></i>
                </button>
                <button
                    onClick={handleClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#ff8a80] transition-colors text-[#9c8b77] hover:text-white group"
                    title="Close"
                >
                    <i className="fa-solid fa-xmark group-hover:rotate-90 transition-transform duration-300"></i>
                </button>
            </div>
        </div>
    );
};

export default TopBar;
