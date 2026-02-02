import React, { useState } from 'react';

const Setup = ({ onComplete }) => {
    const [path, setPath] = useState('');
    const [checks, setChecks] = useState(null);
    const handleBrowse = async () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            try {
                const folder = await window.chrome.webview.hostObjects.appBridge.SelectFolder();
                if (folder) {
                    setPath(folder);
                    //Check if the folder exists (from C#)
                    const structureJson = await window.chrome.webview.hostObjects.appBridge.CheckFolderStructure(folder);
                    const structure = JSON.parse(structureJson);
                    setChecks(structure);
                    if (structure.EffectivePath) {
                        setPath(structure.EffectivePath);
                    }

                }
            } catch (error) {
                console.error("Bridge Error:", error);
            }
        } else {
            // Dev Mock
            console.log("Mock Browse");
            setPath("C:/Mock/Path/To/Collection");
            setChecks({ New: false, Library: true, Backups: false });
        }
    };

    const handleConfirm = async () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            await window.chrome.webview.hostObjects.appBridge.InitializeCollection(path);
            onComplete();
        } else {
            console.log("Mock Confirm");
            onComplete();
        }
    };

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center relative overflow-hidden select-none drag-region">
            {/* Background */}
            <i className="fa-solid fa-music bg-icon text-6xl top-10 left-10 rotate-[-12deg] text-[#88c9a1]"></i>
            <i className="fa-solid fa-leaf bg-icon text-8xl bottom-10 right-10 rotate-[24deg] text-[#eebb4d]"></i>
            <i className="fa-solid fa-star bg-icon text-4xl top-20 right-20 text-[#d4cdb6]"></i>

            <div className="w-[480px] bg-[#fffefb] rounded-[40px] shadow-[0_20px_40px_-10px_rgba(92,75,55,0.15)] flex flex-col overflow-hidden border-4 border-[#fffefb] relative z-10 no-drag">
                {/*The Green Strip */}
                <div className="h-5 bg-[#88c9a1] w-full absolute top-0 left-0 opacity-30"></div>

                {/*Header */}
                <div className="px-8 pt-8 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-[#f0f3e6] rounded-full mb-3 text-[#eebb4d] shadow-sm ring-4 ring-white">
                        <i className="fa-solid fa-leaf text-2xl"></i>
                    </div>
                    <h1 className="text-2xl font-extrabold text-[#5c4b37]">Welcome to Darjeeling</h1>
                    <p className="text-sm font-semibold text-[#9c8b77] mt-1">Let's set up your music collection.</p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    {/* Folder Selection Div */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#9c8b77] mb-2 ml-2">1. Collection Source Folder</label>
                        <div
                            onClick={handleBrowse}
                            className="dashed-border bg-[#f9f7f0] h-16 rounded-xl flex items-center px-4 cursor-pointer hover:bg-[#fff9e6] hover:shadow-sm transition-all group relative"
                        >
                            <div className="w-8 h-8 bg-[#eebb4d] rounded-lg flex items-center justify-center text-white mr-3 shadow-sm group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-folder"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold truncate ${path ? 'text-[#5c4b37]' : 'text-[#9c8b77] italic'}`}>
                                    {path || "Click to browse..."}
                                </div>
                                {path && <div className="text-[10px] text-[#9c8b77] font-semibold">Ready to scan</div>}
                            </div>
                            <button className="text-[#9c8b77] hover:text-[#5c4b37] px-2 bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center">
                                <i className="fa-solid fa-pen text-xs"></i>
                            </button>
                        </div>
                    </div>

                    {/*Structure Check */}
                    {path && checks && (
                        <div className="relative animate-fade-in-up">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#9c8b77] mb-2 ml-2">2. Structure Check</label>
                            {/* Connector Lines */}
                            <div className="absolute left-6 top-8 bottom-4 w-0.5 bg-[#e8e3d3] -z-10"></div>

                            <div className="space-y-3">
                                {/* Helper for CheckItem */}
                                <CheckItem
                                    icon="fa-star"
                                    colorClass="text-[#26a69a]"
                                    bgClass="bg-[#e0f2f1]"
                                    name="/New"
                                    exists={checks.New}
                                    desc="Drop your newly downloaded songs."
                                />
                                <CheckItem
                                    icon="fa-book"
                                    colorClass="text-[#7cb342]"
                                    bgClass="bg-[#f1f8e9]"
                                    name="/Library"
                                    exists={checks.Library}
                                    desc={<>Where your organized music tracks live.<br />(Should be configure with SoulSeek/Nicotine+).</>}
                                />
                                <CheckItem
                                    icon="fa-database"
                                    colorClass="text-[#78909c]"
                                    bgClass="bg-[#eceff1]"
                                    name="/Backups"
                                    exists={checks.Backups}
                                    desc="Stores restore points & JSONs."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-[#f9f7f0] p-6 border-t border-[#f0f3e6] flex justify-center">
                    <button
                        onClick={handleConfirm}
                        disabled={!path}
                        className={`w-full text-[#fffefb] rounded-2xl py-3 font-extrabold text-lg transition-all flex items-center justify-center gap-2 
                            ${!path ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#5c4b37] shadow-[0_4px_0_#3e3224] hover:shadow-[0_2px_0_#3e3224] hover:translate-y-[2px] active:scale-95'}`}
                    >
                        <span>Everything looks good!</span>
                        <i className="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper Component for the Check Items
const CheckItem = ({ icon, colorClass, bgClass, name, exists, desc }) => (
    <div className="flex items-start gap-3 bg-white border border-[#f0f3e6] p-2 rounded-xl shadow-sm z-10 relative">
        <div className={`w-10 h-10 ${bgClass} ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#5c4b37]">{name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${exists ? 'bg-[#f1f8e9] text-[#7cb342]' : 'bg-[#e0f2f1] text-[#26a69a]'}`}>
                    {exists ? 'Exists' : 'Created'}
                </span>
            </div>
            <p className="text-xs text-[#9c8b77] leading-tight mt-0.5">{desc}</p>
        </div>
    </div>
);

export default Setup;
