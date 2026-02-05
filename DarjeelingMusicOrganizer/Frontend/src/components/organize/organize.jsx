import React, { useState } from 'react';
import Importer from './importer';
import Organizer from './organizer';
import Restorer from './restorer';


const Organize = () => {
    //Default to 'importer'
    const [subTab, setSubTab] = useState('importer');

    //Render the appropriate sub-component based on state
    const renderSubContent = () => {
        switch (subTab) {
            case 'importer': return <Importer />;
            case 'organizer': return <Organizer />;
            case 'restore': return <Restorer />;
            default: return <Importer />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#fcfbf9]">

            {/* SUB-NAV */}
            <div className="h-14 bg-[#fffefb] border-b border-[#e8e3d3] flex items-center justify-center shrink-0 relative z-10 w-full">
                <div className="bg-[#f0f3e6] p-1.5 rounded-xl flex text-xs font-bold shadow-inner gap-1">

                    {/*Importer  */}
                    <button
                        onClick={() => setSubTab('importer')}
                        className={`px-5 py-2 rounded-lg transition flex items-center gap-2 ${subTab === 'importer'
                            ? 'bg-white text-[#5c4b37] shadow-sm border border-[#d4cdb6]'
                            : 'text-[#9c8b77] hover:text-[#5c4b37] hover:bg-[#e8e3d3]'
                            }`}
                    >
                        <i className={`fa-solid fa-file-import ${subTab === 'importer' ? 'text-[#88c9a1]' : ''}`}></i>
                        Importer
                    </button>

                    {/*Organizer */}
                    <button
                        onClick={() => setSubTab('organizer')}
                        className={`px-6 py-2 rounded-lg transition flex items-center gap-2 ${subTab === 'organizer'
                            ? 'bg-white text-[#5c4b37] shadow-sm border border-[#d4cdb6]'
                            : 'text-[#9c8b77] hover:text-[#5c4b37] hover:bg-[#e8e3d3]'
                            }`}
                    >
                        <i className={`fa-solid fa-wand-magic-sparkles ${subTab === 'organizer' ? 'text-[#88c9a1]' : ''}`}></i>
                        Organizer
                    </button>

                    {/*Restore  */}
                    <button
                        onClick={() => setSubTab('restore')}
                        className={`px-5 py-2 rounded-lg transition flex items-center gap-2 ${subTab === 'restore'
                            ? 'bg-white text-[#5c4b37] shadow-sm border border-[#d4cdb6]'
                            : 'text-[#9c8b77] hover:text-[#5c4b37] hover:bg-[#e8e3d3]'
                            }`}
                    >
                        <i className={`fa-solid fa-clock-rotate-left ${subTab === 'restore' ? 'text-[#88c9a1]' : ''}`}></i>
                        Restore
                    </button>

                </div>
            </div>

            {/*Main Content Area*/}
            <div className="flex-1 overflow-hidden relative">
                {renderSubContent()}
            </div>

        </div>
    );
};

export default Organize;
