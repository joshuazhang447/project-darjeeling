import React, { useState } from 'react';
import NavBar from './NavBar';
import Organize from './organize/organize';
import Play from './Play';
import Settings from './Settings';
import Footer from './Footer';

const Display = () => {
    const [activeTab, setActiveTab] = useState('play');
    const [currentModel, setCurrentModel] = useState(null);
    const [appVersion, setAppVersion] = useState("v0.1.0 Alpha");

    const loadSettings = async () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            try {
                // Settings
                const settingsJson = await window.chrome.webview.hostObjects.appBridge.GetSettings();
                if (settingsJson) {
                    const settings = JSON.parse(settingsJson);
                    setCurrentModel(settings.ModelVersion ? settings.ModelVersion : null);
                }

                // Version
                const ver = await window.chrome.webview.hostObjects.appBridge.GetAppVersion();
                if (ver) setAppVersion(ver);

            } catch (e) {
                console.error("Failed to load settings for footer", e);
            }
        }
    };

    React.useEffect(() => {
        loadSettings();
    }, []);

    const handleSaveSuccess = () => {
        loadSettings();
        setActiveTab('play');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'organize': return <Organize />;
            case 'play': return <Play />;
            case 'settings': return <Settings onSaveSuccess={handleSaveSuccess} />;
            default: return <Organize />;
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden select-none bg-[#f0f3e6]">

            {/*Title Bar Spacer / Drag Region */}
            <div className="h-10 w-full shrink-0 drag-region" />

            {/*NavBar */}
            <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/*ContentArea */}
            <main className="flex-1 bg-[#fffefb] mx-0 relative shadow-sm flex flex-col overflow-hidden">
                {renderContent()}
            </main>

            {/*Footer */}
            <Footer
                currentModel={currentModel}
                version={appVersion}
                onNavigateToSettings={() => setActiveTab('settings')}
            />
        </div>
    );
};

export default Display;
