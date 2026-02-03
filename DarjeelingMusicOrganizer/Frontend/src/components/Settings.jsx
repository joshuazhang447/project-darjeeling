import React, { useState, useEffect } from 'react';
import { PROVIDERS } from '../constants/providers';

const Settings = ({ onSaveSuccess }) => {
    //model, folders, misc
    const [activeSection, setActiveSection] = useState('model');
    const settingsDefaults = {
        AiProvider: 'Google',
        ApiKey: '',
        ApiEndpoint: PROVIDERS.Google.defaultEndpoint,
        ApiEndpoint: PROVIDERS.Google.defaultEndpoint,
        ModelVersion: PROVIDERS.Google.models[0].value
    };

    const [folderStats, setFolderStats] = useState(null);


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
                    console.log("[Settings] Loaded JSON:", savedSettingsJson);

                    if (savedSettingsJson) {
                        const saved = JSON.parse(savedSettingsJson);
                        console.log("[Settings] Parsed:", saved);

                        // Defaults
                        const providerDefaults = PROVIDERS.Google;
                        const defaultEndpoint = providerDefaults.defaultEndpoint;
                        const defaultModel = providerDefaults.models[0].value;

                        // Robust Mapping (Handle PascalCase from C# or camelCase potential)
                        // This explicitly looks for the keys we expect
                        const loadedSettings = {
                            AiProvider: saved.AiProvider || saved.aiProvider || 'Google',
                            ApiKey: saved.ApiKey || saved.apiKey || '',
                            ApiEndpoint: saved.ApiEndpoint || saved.apiEndpoint || defaultEndpoint,
                            ModelVersion: saved.ModelVersion || saved.modelVersion || defaultModel
                        };

                        setSettings(prev => ({
                            ...prev,
                            ...loadedSettings
                        }));
                    }
                } catch (e) {
                    console.error("[Settings] Failed to load settings", e);
                }
            }
        };
        loadSettings();
    }, []);

    //Load Folder Stats when section changes to 'folders'
    useEffect(() => {
        if (activeSection === 'folders' && window.chrome?.webview?.hostObjects?.appBridge) {
            const loadStats = async () => {
                try {
                    const statsJson = await window.chrome.webview.hostObjects.appBridge.GetCollectionStats();
                    const stats = JSON.parse(statsJson);
                    setFolderStats(stats);
                } catch (e) {
                    console.error("Failed to load stats", e);
                }
            };
            loadStats();
        } else if (activeSection === 'folders' && !window.chrome?.webview?.hostObjects?.appBridge) {
            //Collection Folder Stats Mock
            setFolderStats({
                RootPath: "C:/Users/Dev/Music/Collection",
                RootSize: "42.8 GB",
                RootFiles: "4,203",
                NewSize: "142 MB",
                LibrarySize: "40.5 GB",
                BackupsSize: "2.1 GB"
            });
        }
    }, [activeSection]);

    const refreshStats = async () => {
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            try {
                const statsJson = await window.chrome.webview.hostObjects.appBridge.GetCollectionStats();
                setFolderStats(JSON.parse(statsJson));
            } catch (e) {
                console.error("Refresh failed", e);
            }
        }
    };

    const openInExplorer = async (path) => {
        if (!path) return;
        if (window.chrome?.webview?.hostObjects?.appBridge) {
            await window.chrome.webview.hostObjects.appBridge.OpenInExplorer(path);
        } else {
            console.log("Mock Open Explorer:", path);
        }
    };

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

    const handleResetCollection = async () => {
        if (window.confirm("Are you sure you want to unlink your collection? You'll need to run setup again.")) {
            if (window.chrome?.webview?.hostObjects?.appBridge) {
                try {
                    await window.chrome.webview.hostObjects.appBridge.ResetCollection();
                    window.location.reload();
                } catch (e) {
                    console.error("Reset failed", e);
                }
            } else {
                console.log("Mock Reset");
                window.location.reload();
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

                        {activeSection === 'folders' && (
                            <>
                                {/*Collection Folder */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-extrabold text-[#5c4b37] uppercase tracking-wide">Root Directory</label>
                                            <button
                                                onClick={refreshStats}
                                                className="text-xs font-bold text-[#9c8b77] hover:text-[#eebb4d] transition flex items-center gap-1 bg-white border border-[#e8e3d3] px-2 py-1 rounded-lg shadow-sm active:translate-y-[1px]"
                                                title="Refresh Stats"
                                            >
                                                <i className="fa-solid fa-rotate-right"></i>
                                                <span>Refresh</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => openInExplorer(folderStats?.RootPath)}
                                            className="text-xs font-bold text-[#9c8b77] hover:text-[#eebb4d] transition flex items-center gap-1"
                                        >
                                            <span>Open in Explorer</span>
                                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                        </button>
                                    </div>

                                    {/*Collection Folder Box */}
                                    <div className="bg-[#f9f7f0] border-4 border-[#e8e3d3] rounded-3xl p-6 relative group transition-all hover:border-[#d4cdb6]">
                                        {/* Decorative Tag */}
                                        <div className="absolute -top-3 left-6 bg-[#5c4b37] text-[#fffefb] text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                            <i className="fa-solid fa-hard-drive mr-1"></i> Main Collection
                                        </div>

                                        <div className="flex items-start gap-5 pt-2">
                                            {/*Collection Folder Icon */}
                                            <div className="w-20 h-20 bg-[#eebb4d] rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 transform rotate-[-3deg] group-hover:rotate-0 transition-transform">
                                                <i className="fa-solid fa-box-archive text-4xl"></i>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {/*Path */}
                                                <div className="font-bold text-[#9c8b77] text-xs uppercase tracking-wider mb-1">Current Location</div>
                                                <div className="font-mono text-sm bg-white border-2 border-[#e8e3d3] rounded-lg px-3 py-2 text-[#5c4b37] truncate mb-3 shadow-sm">
                                                    {folderStats?.RootPath || "Loading..."}
                                                </div>

                                                {/* Stats Bar */}
                                                <div className="flex gap-4">
                                                    <div className="bg-white px-3 py-1 rounded-lg border border-[#e8e3d3] shadow-sm flex items-center gap-2">
                                                        <i className="fa-solid fa-weight-hanging text-[#9c8b77] text-xs"></i>
                                                        <span className="font-bold text-sm text-[#5c4b37]">{folderStats?.RootSize || "..."}</span>
                                                    </div>
                                                    <div className="bg-white px-3 py-1 rounded-lg border border-[#e8e3d3] shadow-sm flex items-center gap-2">
                                                        <i className="fa-solid fa-music text-[#9c8b77] text-xs"></i>
                                                        <span className="font-bold text-sm text-[#5c4b37]">{folderStats?.RootFiles || "..."} Files</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/*SubFolders Structure */}
                                <section className="relative pl-10">
                                    {/*Connecting Line */}
                                    <div className="absolute left-10 top-[-20px] bottom-10 w-1 border-l-4 border-dotted border-[#e8e3d3]"></div>

                                    <label className="block text-sm font-extrabold text-[#5c4b37] uppercase tracking-wide mb-4 relative z-10 bg-[#fffefb] inline-block pr-2">
                                        Sub-Folders
                                    </label>

                                    <div className="space-y-4">

                                        {/*New Folder */}
                                        <div className="relative">
                                            <div className="absolute -left-10 top-8 w-8 border-t-4 border-dotted border-[#e8e3d3]"></div>
                                            <div className="bg-white border-2 border-[#f0f3e6] rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition">
                                                <div className="w-12 h-12 bg-[#EDF2EC] text-[#4A5D4E] rounded-xl flex items-center justify-center text-xl shrink-0">
                                                    <i className="fa-solid fa-star"></i>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[#5c4b37] text-lg">/New</div>
                                                    <div className="text-xs text-[#9c8b77] font-semibold">Drop your newly downloaded songs.</div>
                                                </div>
                                                <div className="bg-[#f9f7f0] px-3 py-1 rounded-lg border border-[#e8e3d3] font-bold text-sm text-[#5c4b37]">
                                                    {folderStats?.NewSize || "..."}
                                                </div>
                                            </div>
                                        </div>

                                        {/*Library Folder */}
                                        <div className="relative">
                                            <div className="absolute -left-10 top-8 w-8 border-t-4 border-dotted border-[#e8e3d3]"></div>
                                            <div className="bg-white border-2 border-[#f0f3e6] rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition">
                                                <div className="w-12 h-12 bg-[#EDF2EC] text-[#4A5D4E] rounded-xl flex items-center justify-center text-xl shrink-0">
                                                    <i className="fa-solid fa-book"></i>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[#5c4b37] text-lg">/Library</div>
                                                    <div className="text-xs text-[#9c8b77] font-semibold">
                                                        Where your organized music tracks live.<br />
                                                        <span className="opacity-80 font-medium">(Should be configured with SoulSeek/Nicotine+)</span>
                                                    </div>
                                                </div>
                                                <div className="bg-[#f9f7f0] px-3 py-1 rounded-lg border border-[#e8e3d3] font-bold text-sm text-[#5c4b37]">
                                                    {folderStats?.LibrarySize || "..."}
                                                </div>
                                            </div>
                                        </div>

                                        {/*Backups Folder */}
                                        <div className="relative">
                                            <div className="absolute -left-10 top-8 w-8 border-t-4 border-dotted border-[#e8e3d3]"></div>
                                            <div className="bg-white border-2 border-[#f0f3e6] rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition">
                                                <div className="w-12 h-12 bg-[#EDF2EC] text-[#4A5D4E] rounded-xl flex items-center justify-center text-xl shrink-0">
                                                    <i className="fa-solid fa-database"></i>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[#5c4b37] text-lg">/Backups</div>
                                                    <div className="text-xs text-[#9c8b77] font-semibold">Stores restore points & JSONs.</div>
                                                </div>
                                                <div className="bg-[#f9f7f0] px-3 py-1 rounded-lg border border-[#e8e3d3] font-bold text-sm text-[#5c4b37]">
                                                    {folderStats?.BackupsSize || "..."}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </section>

                                <hr className="border-t-2 border-dotted border-[#e8e3d3]" />

                                {/* Reset */}
                                <section className="pt-2">
                                    <div className="dashed-border bg-[#fff5f5] rounded-3xl p-6 border border-[#ffcdd2] relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-full opacity-50 bg-[repeating-linear-gradient(45deg,#ffebee,#ffebee_10px,transparent_10px,transparent_20px)] pointer-events-none"></div>

                                        <div className="flex items-center justify-between gap-6 relative z-10">
                                            <div>
                                                <h3 className="font-bold text-[#c62828] text-lg flex items-center gap-2">
                                                    <i className="fa-solid fa-triangle-exclamation"></i> Reset Collection
                                                </h3>
                                                <p className="text-xs text-[#b71c1c] opacity-80 mt-1 max-w-sm leading-relaxed font-semibold">
                                                    This will unlink the current root folder. Your music files will <span className="underline">not</span> be deleted, but you will need to run the setup again to select another location.
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleResetCollection}
                                                className="ac-btn bg-[#ef5350] hover:bg-[#e53935] text-white px-6 py-4 rounded-xl font-extrabold shadow-[0_4px_0_#b71c1c] hover:shadow-[0_2px_0_#b71c1c] hover:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3 shrink-0"
                                            >
                                                <i className="fa-solid fa-unlink"></i>
                                                <span>Reset & Unlink</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}

                        {activeSection === 'misc' && (
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
