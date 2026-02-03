import React, { useState, useEffect } from 'react';
import { PROVIDERS } from '../constants/providers';

const Settings = ({ onSaveSuccess }) => {
    //model, folders, misc
    const [activeSection, setActiveSection] = useState('model');
    const settingsDefaults = {
        AiProvider: 'Google',
        ApiKey: '',
        ApiEndpoint: PROVIDERS.Google.defaultEndpoint,
        ModelVersion: PROVIDERS.Google.models[0].value
    };

    //Initial the defaults settings
    const [settings, setSettings] = useState(settingsDefaults);

    //Status of idle, testing, connecte and error
    const [connectionStatus, setConnectionStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            if (window.chrome?.webview?.hostObjects?.appBridge) {
                try {
                    const savedSettingsJson = await window.chrome.webview.hostObjects.appBridge.GetSettings();
                    if (savedSettingsJson) {
                        const saved = JSON.parse(savedSettingsJson);

                        //Forcing Google, since all others are disabled
                        const currentProvider = 'Google';
                        const providerDefaults = PROVIDERS.Google;

                        setSettings(prev => ({
                            ...prev,
                            ...saved,
                            //Ensure defaults if backend returned null/empty for these critical fields
                            ApiEndpoint: saved.ApiEndpoint || providerDefaults.defaultEndpoint,
                            ModelVersion: saved.ModelVersion || providerDefaults.models[0].value
                        }));
                    }
                } catch (e) {
                    console.error("Failed to load settings", e);
                }
            }
        };
        loadSettings();
    }, []);

    //Force lowercases for all internal logic
    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        if (key === 'ApiKey' || key === 'ApiEndpoint') {
            setConnectionStatus('idle');
        }
    };

    const handleProviderChange = (providerKey) => {
        const config = PROVIDERS[providerKey];
        if (!config) return;

        setSettings(prev => ({
            ...prev,
            AiProvider: providerKey,
            ApiEndpoint: config.defaultEndpoint,
            ModelVersion: config.models[0].value,
            ApiKey: '' // Clears the key when switching providers (Not useful rn)
        }));
        setConnectionStatus('idle');
    };

    const handleTestConnection = async () => {
        setConnectionStatus('testing');
        setErrorMessage('');

        if (window.chrome?.webview?.hostObjects?.appBridge) {
            try {
                //Minimum animation 1s
                const startTime = Date.now();

                const responseJson = await window.chrome.webview.hostObjects.appBridge.TestConnection(JSON.stringify(settings));
                const response = JSON.parse(responseJson);

                const elapsed = Date.now() - startTime;
                //1s here
                const remaining = Math.max(0, 1000 - elapsed);

                setTimeout(() => {
                    if (response.success) {
                        setConnectionStatus('connected');
                    } else {
                        setConnectionStatus('error');
                        setErrorMessage(response.message);
                    }
                }, remaining);

            } catch (e) {
                setConnectionStatus('error');
                setErrorMessage(e.message || "Unknown bridge error");
            }
        } else {
            //Mock
            setTimeout(() => {
                if (settings.ApiKey === 'error') {
                    setConnectionStatus('error');
                    setErrorMessage("Mock Error: 401 Unauthorized");
                } else {
                    setConnectionStatus('connected');
                }
            }, 1000);
        }
    };

    const handleSave = async () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            try {
                await window.chrome.webview.hostObjects.appBridge.SaveSettings(JSON.stringify(settings));
                //Redirect to Play tab if onSavSuccess
                if (onSaveSuccess) onSaveSuccess();
            } catch (e) {
                console.error("Save failed", e);
            }
        }
    };

    const currentProviderConfig = PROVIDERS[settings.AiProvider] || PROVIDERS.Google;
    //Helpers to get Icon dynamically
    const ProviderIconConfig = currentProviderConfig.icon;
    const ProviderIcon = ProviderIconConfig.Color || ProviderIconConfig;


    return (
        <div className="flex-1 flex overflow-hidden">
            {/*LEFT SIDE */}
            <aside className="w-64 bg-[#f9f7f0] border-r border-[#e8e3d3] flex flex-col p-4 gap-2 shrink-0">
                <div className="text-xs font-extrabold text-[#9c8b77] uppercase tracking-wider pl-4 mb-2 mt-2">Configuration</div>

                <button
                    onClick={() => setActiveSection('model')}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 transition ${activeSection === 'model' ? 'bg-white shadow-sm border-l-4 border-[#eebb4d] text-[#5c4b37]' : 'text-[#9c8b77] hover:bg-[#e8e3d3]'}`}
                >
                    <i className={`fa-solid fa-robot ${activeSection === 'model' ? 'text-[#eebb4d]' : ''}`}></i>
                    Model Selection
                </button>

                <button
                    onClick={() => setActiveSection('folders')}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 transition ${activeSection === 'folders' ? 'bg-white shadow-sm border-l-4 border-[#eebb4d] text-[#5c4b37]' : 'text-[#9c8b77] hover:bg-[#e8e3d3]'}`}
                >
                    <i className={`fa-solid fa-folder-tree ${activeSection === 'folders' ? 'text-[#eebb4d]' : ''}`}></i>
                    Collection Folder
                </button>

                <button
                    onClick={() => setActiveSection('misc')}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold flex items-center gap-3 transition ${activeSection === 'misc' ? 'bg-white shadow-sm border-l-4 border-[#eebb4d] text-[#5c4b37]' : 'text-[#9c8b77] hover:bg-[#e8e3d3]'}`}
                >
                    <i className={`fa-solid fa-wrench ${activeSection === 'misc' ? 'text-[#eebb4d]' : ''}`}></i>
                    Miscellaneous
                </button>
            </aside>

            {/*RIGHT SIDE */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#fffefb]">

                {/*Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl mx-auto space-y-8 pb-8">

                        {activeSection === 'model' && (
                            <>
                                {/* 1. Provider Selection, only google available, more to come */}
                                <section>
                                    <label className="block text-sm font-extrabold text-[#5c4b37] uppercase tracking-wide mb-3">
                                        AI Provider
                                    </label>
                                    <div className="grid grid-cols-4 gap-4">
                                        {/*Google */}
                                        <div
                                            onClick={() => handleProviderChange('Google')}
                                            className={`relative cursor-pointer transition transform active:scale-95 ${settings.AiProvider === 'Google' ? '' : 'opacity-70 hover:opacity-100'}`}
                                        >
                                            {settings.AiProvider === 'Google' && (
                                                <div className="absolute -top-2 -right-2 bg-[#88c9a1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md z-10 border-2 border-white">
                                                    <i className="fa-solid fa-check"></i>
                                                </div>
                                            )}
                                            <div className={`bg-white border-2 ${settings.AiProvider === 'Google' ? 'border-[#88c9a1] shadow-[0_4px_0_#d4cdb6]' : 'border-[#e8e3d3]'} rounded-2xl p-4 flex flex-col items-center gap-3 h-32 justify-center`}>
                                                <span className={settings.AiProvider !== 'Google' ? 'grayscale' : ''}><ProviderIcon size={56} /></span>
                                                <span className="font-bold text-sm text-[#5c4b37]">Google</span>
                                            </div>
                                        </div>

                                        {/*OpenAI (DISABLED) */}
                                        <div className="relative opacity-50 grayscale cursor-not-allowed">
                                            <div className="bg-[#f9f7f0] border-2 border-[#e8e3d3] rounded-2xl p-4 flex flex-col items-center gap-3 h-32 justify-center">
                                                <PROVIDERS.OpenAI.icon size={56} />
                                                <span className="font-bold text-sm text-[#5c4b37]">OpenAI</span>
                                            </div>
                                        </div>

                                        {/*Claude (Disabled) */}
                                        <div className="relative opacity-50 grayscale cursor-not-allowed">
                                            <div className="bg-[#f9f7f0] border-2 border-[#e8e3d3] rounded-2xl p-4 flex flex-col items-center gap-3 h-32 justify-center">
                                                <PROVIDERS.Claude.icon size={56} />
                                                <span className="font-bold text-sm text-[#5c4b37]">Claude</span>
                                            </div>
                                        </div>

                                        {/*Grok (Disabled) */}
                                        <div className="relative opacity-50 grayscale cursor-not-allowed">
                                            <div className="bg-[#f9f7f0] border-2 border-[#e8e3d3] rounded-2xl p-4 flex flex-col items-center gap-3 h-32 justify-center">
                                                <PROVIDERS.Grok.icon size={56} />
                                                <span className="font-bold text-sm text-[#5c4b37]">Grok</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <hr className="border-t-2 border-dotted border-[#e8e3d3]" />

                                {/* 2. Inputs */}
                                <section className="space-y-4">
                                    {/*API Key */}
                                    <div>
                                        <label className="block text-xs font-bold text-[#9c8b77] uppercase tracking-wider mb-2 ml-1">API Key</label>
                                        <div className="relative">
                                            <input
                                                type={showKey ? "text" : "password"}
                                                value={settings.ApiKey}
                                                onChange={(e) => updateSetting('ApiKey', e.target.value)}
                                                className="w-full bg-[#f9f7f0] border border-[#e8e3d3] rounded-xl px-4 py-3 text-[#5c4b37] font-mono text-sm placeholder-[#d4cdb6] focus:outline-none focus:ring-2 focus:ring-[#88c9a1] focus:border-transparent transition-all"
                                                placeholder={`Enter your ${currentProviderConfig.label} API Key...`}
                                            />
                                            <button
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-3 top-3 text-[#9c8b77] hover:text-[#5c4b37]"
                                            >
                                                <i className={`fa-solid ${showKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 ml-1">
                                            <i className="fa-solid fa-lock text-[10px] text-[#88c9a1]"></i>
                                            <p className="text-[10px] text-[#88c9a1] font-bold">Stored locally & encrypted.</p>
                                        </div>
                                    </div>

                                    {/*API Address */}
                                    <div>
                                        <label className="block text-xs font-bold text-[#9c8b77] uppercase tracking-wider mb-2 ml-1">API Endpoint</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={settings.ApiEndpoint}
                                                onChange={(e) => updateSetting('ApiEndpoint', e.target.value)}
                                                className="w-full bg-[#f9f7f0] border border-[#e8e3d3] rounded-xl px-4 py-3 text-[#5c4b37] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#88c9a1] focus:border-transparent transition-all"
                                            />
                                            <button
                                                onClick={() => updateSetting('ApiEndpoint', currentProviderConfig.defaultEndpoint)}
                                                className="absolute right-3 top-3 text-[#9c8b77] hover:text-[#5c4b37] text-xs font-bold border border-[#d4cdb6] px-2 py-0.5 rounded"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>

                                    {/* Model Selection */}
                                    <div>
                                        <label className="block text-xs font-bold text-[#9c8b77] uppercase tracking-wider mb-2 ml-1">Model Selection</label>
                                        <div className="relative">
                                            <select
                                                value={settings.ModelVersion}
                                                onChange={(e) => updateSetting('ModelVersion', e.target.value)}
                                                className="w-full bg-[#fff] border-2 border-[#e8e3d3] rounded-xl px-4 py-3 text-[#5c4b37] font-bold appearance-none cursor-pointer hover:border-[#eebb4d] focus:outline-none focus:border-[#eebb4d] transition"
                                            >
                                                {currentProviderConfig.models.map(model => (
                                                    <option key={model.value} value={model.value}>{model.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-4 text-[#5c4b37] pointer-events-none">
                                                <i className="fa-solid fa-chevron-down"></i>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <hr className="border-t-2 border-dotted border-[#e8e3d3]" />

                                {/* 3. Testing & Status */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-extrabold text-[#5c4b37] uppercase tracking-wide">Connection Status</label>
                                        {connectionStatus !== 'testing' && (
                                            <button
                                                onClick={handleTestConnection}
                                                className="bg-[#eebb4d] hover:bg-[#ffca28] text-white px-5 py-2 rounded-xl font-bold text-sm shadow-[0_3px_0_#d4a017] active:shadow-none active:translate-y-[3px] transition-all"
                                            >
                                                <i className="fa-solid fa-bolt mr-2"></i>Test Connection
                                            </button>
                                        )}
                                    </div>

                                    {/* STATUS */}
                                    {/* Connected */}
                                    {connectionStatus === 'connected' && (
                                        <div className="bg-[#e8f5e9] border border-[#88c9a1] rounded-xl p-4 flex items-center gap-3 animate-fade-in">
                                            <div className="w-8 h-8 rounded-full bg-[#88c9a1] flex items-center justify-center text-white">
                                                <i className="fa-solid fa-check"></i>
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#2e7d32]">Connected</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Waiting */}
                                    {connectionStatus === 'testing' && (
                                        <div className="bg-[#fff8e1] border border-[#ffb74d] rounded-xl p-4 flex items-center gap-3 animate-pulse">
                                            <div className="w-8 h-8 rounded-full bg-[#ffa726] flex items-center justify-center text-white animate-spin">
                                                <i className="fa-solid fa-circle-notch"></i>
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#ef6c00]">Connecting...</div>
                                                <div className="text-xs text-[#ef6c00] opacity-80">Verifying API Key</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {connectionStatus === 'error' && (
                                        <div className="bg-[#ffebee] border border-[#ef5350] rounded-xl p-4 flex flex-col gap-2 animate-shake">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#ef5350] flex items-center justify-center text-white">
                                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                                </div>
                                                <div className="font-bold text-[#c62828]">Connection Failed</div>
                                            </div>
                                            <div className="bg-[#ffcdd2] p-2 rounded text-[10px] font-mono text-[#b71c1c] overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                {errorMessage}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </>
                        )}

                        {activeSection !== 'model' && (
                            <div className="flex items-center justify-center h-48 border-2 border-dashed border-[#e8e3d3] rounded-2xl">
                                <span className="text-[#9c8b77] font-bold">This section is not implemented yet.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/*Save Bar */}
                <div className="bg-[#fffefb] border-t border-[#e8e3d3] p-4 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={handleSave}
                        className="bg-[#5c4b37] text-white px-8 py-2 rounded-xl font-bold shadow-[0_4px_0_#3e3224] hover:shadow-[0_2px_0_#3e3224] hover:translate-y-[2px] transition-all active:shadow-none active:translate-y-[4px]"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
