import React, { useState } from 'react';
import NavBar from './NavBar';
import Organize from './Organize';
import Play from './Play';
import Settings from './Settings';

const Display = () => {
    const [activeTab, setActiveTab] = useState('play');

    const renderContent = () => {
        switch (activeTab) {
            case 'organize': return <Organize />;
            case 'play': return <Play />;
            case 'settings': return <Settings />;
            default: return <Organize />;
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden select-none bg-[#f0f3e6]">

            {/*NavBar */}
            <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/*ContentArea */}
            <main className="flex-1 bg-[#fffefb] mx-0 relative shadow-sm flex flex-col overflow-hidden">
                {renderContent()}
            </main>
        </div>
    );
};

export default Display;
