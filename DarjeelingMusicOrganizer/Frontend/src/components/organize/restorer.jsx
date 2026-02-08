import React, { useState, useEffect, useCallback } from 'react';
import LogBar from './LogBar';

const Restorer = () => {
    const [selectedBackupId, setSelectedBackupId] = useState(null);
    const [backups, setBackups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [logStatus, setLogStatus] = useState('ready');
    const [logMessage, setLogMessage] = useState('Select a timestamp above and press "RESTORE BACKUP" to revert your library.');
    const [logError, setLogError] = useState(null);
    const [restorePollInterval, setRestorePollInterval] = useState(null);

    /**
     *Load available backups from backend
     */
    const loadBackups = useCallback(async () => {
        try {
            setIsLoading(true);
            const backupsJson = await window.chrome.webview.hostObjects.appBridge.GetAvailableBackups();
            const backupsList = JSON.parse(backupsJson);

            setBackups(backupsList);

            //Auto-select the latest backup if available
            if (backupsList.length > 0 && !selectedBackupId) {
                setSelectedBackupId(backupsList[0].id);
            }
        } catch (error) {
            console.error('Error loading backups:', error);
            setLogStatus('error');
            setLogError('Failed to load backup list.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBackupId]);

    useEffect(() => {
        loadBackups();

        return () => {
            //Cleanup polling on unmount
            if (restorePollInterval) {
                clearInterval(restorePollInterval);
            }
        };
    }, []);

    /**
     *Handle restore button click
     */
    const handleRestore = async () => {
        if (!selectedBackupId) {
            setLogStatus('error');
            setLogError('Please select a backup to restore.');
            return;
        }

        //Find selected backup for display in confirmation
        const selectedBackup = backups.find(b => b.id === selectedBackupId);
        const backupDate = selectedBackup?.formattedDate || selectedBackupId;

        //Confirmation prompt
        const confirmed = window.confirm(
            `⚠️ WARNING: This action will restore your library to the state from ${backupDate}.\n\n` +
            `• Files may be moved or renamed to match the backup\n` +
            `• Any changes made after this backup will be reverted\n` +
            `• This action cannot be undone\n\n` +
            `Are you sure you want to continue?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setLogError(null);
            setLogStatus('working');
            setLogMessage('Starting restore...');

            // Start async restore
            await window.chrome.webview.hostObjects.appBridge.StartRestore(selectedBackupId);

            //Poll for status
            const pollId = setInterval(async () => {
                try {
                    const statusJson = await window.chrome.webview.hostObjects.appBridge.GetRestoreStatus();
                    const status = JSON.parse(statusJson);

                    if (status.status === 'working') {
                        setLogStatus('working');
                        setLogMessage(status.message);
                    } else if (status.status === 'success') {
                        clearInterval(pollId);
                        setRestorePollInterval(null);
                        //Keep showing 'working' with spinning icon during refresh
                        setLogStatus('working');
                        setLogMessage('Refreshing...');

                        //Reset status and refresh the page after short delay
                        setTimeout(() => {
                            window.chrome.webview.hostObjects.appBridge.ResetRestoreStatus();
                            // Refresh the entire app to reflect restored library state
                            window.location.reload();
                        }, 1000);
                    } else if (status.status === 'error') {
                        clearInterval(pollId);
                        setRestorePollInterval(null);
                        setLogStatus('error');
                        setLogError(status.message);
                        window.chrome.webview.hostObjects.appBridge.ResetRestoreStatus();
                    }
                } catch (err) {
                    console.error('Poll error:', err);
                }
            }, 500);

            setRestorePollInterval(pollId);

        } catch (error) {
            console.error('Restore error:', error);
            setLogStatus('error');
            setLogError(error.message || 'An unexpected error occurred');
        }
    };

    /**
     * Empty State Component - No backups available
     */
    const EmptyState = () => (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-[#f0f3e6] rounded-full flex items-center justify-center mb-6 border-4 border-[#e8e3d3]">
                <i className="fa-solid fa-clock-rotate-left text-4xl text-[#d4cdb6]"></i>
            </div>
            <h3 className="text-xl font-bold text-[#5c4b37] mb-2">No Backups Available</h3>
            <p className="text-sm text-[#9c8b77] max-w-md mb-4">
                No snapshots have been created yet. Backups are automatically generated
                whenever you <strong>Import/Refresh</strong> your library.
            </p>
            <p className="text-xs text-[#d4cdb6] italic">
                Go to the Import tab to scan your library and create your first backup.
            </p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#e8e3d3]/30">

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-hidden p-6 flex flex-col gap-8">

                {/* THE BIG ACTION BUTTON (Restore Theme) */}
                <div className="shrink-0 flex justify-center pt-2">
                    <button
                        className="group bg-[#5c4b37] text-white w-full max-w-md py-4 rounded-xl font-bold shadow-[0_6px_0_#3e3224] hover:shadow-[0_3px_0_#3e3224] hover:translate-y-[3px] transition-all active:shadow-none active:translate-y-[6px] flex items-center justify-center gap-5 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleRestore}
                        disabled={logStatus === 'working' || backups.length === 0}
                    >
                        {/* Animated Icon Container (Terracotta Color) */}
                        <div className={`w-12 h-12 bg-[#d87c4a] rounded-full flex items-center justify-center text-[#fffefb] group-hover:-rotate-180 transition-transform duration-500 shadow-inner border-2 border-[#5c4b37]/20 ${logStatus === 'working' ? 'animate-spin' : ''}`}>
                            <i className="fa-solid fa-rotate-left text-2xl"></i>
                        </div>

                        {/* Text Stack */}
                        <div className="flex flex-col items-start text-left">
                            <span className="text-xl font-extrabold tracking-wide">RESTORE BACKUP</span>
                            <span className="text-[11px] text-[#d4cdb6] font-semibold uppercase tracking-wider opacity-90">Revert Library to Selected Point</span>
                        </div>
                    </button>
                </div>

                {/* THE BACKUP LIST */}
                <div className="flex-1 bg-[#fffefb] rounded-2xl border-4 border-[#e8e3d3] flex flex-col overflow-hidden shadow-sm max-w-4xl w-full mx-auto relative">

                    {/* Header */}
                    <div className="p-3 border-b border-[#e8e3d3] bg-[#fcfbf9] flex justify-between items-center shrink-0">
                        <div className="font-extrabold text-[#5c4b37] uppercase tracking-wide text-xs flex items-center gap-2">
                            <i className="fa-solid fa-history text-[#9c8b77]"></i>
                            Available Restore Points
                        </div>

                        {/* Filter / Count */}
                        <div className="flex gap-2 text-[11px] font-bold text-[#9c8b77] bg-[#f0f3e6] px-3 py-1 rounded-lg border border-[#e8e3d3]">
                            <span className="text-[#5c4b37]">{backups.length} Backups Found</span>
                        </div>
                    </div>

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar backup-list-container" style={{
                        backgroundImage: 'linear-gradient(#e8e3d3 1px, transparent 1px)',
                        backgroundSize: '100% 48px'
                    }}>
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <i className="fa-solid fa-spinner animate-spin text-2xl text-[#9c8b77]"></i>
                            </div>
                        ) : backups.length === 0 ? (
                            <EmptyState />
                        ) : (
                            backups.map((backup) => (
                                <div
                                    key={backup.id}
                                    onClick={() => setSelectedBackupId(backup.id)}
                                    className={`group flex items-center gap-4 p-4 rounded-xl bg-white border-2 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden ${selectedBackupId === backup.id
                                        ? 'border-[#88c9a1]'
                                        : 'border-[#e8e3d3] hover:border-[#d87c4a]'
                                        }`}
                                >
                                    {/* LATEST Badge */}
                                    {backup.isLatest && (
                                        <div className="absolute top-0 right-0 bg-[#88c9a1] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                                            LATEST
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors ${selectedBackupId === backup.id
                                        ? 'bg-[#EDF2EC] text-[#4A5D4E]'
                                        : 'bg-[#f9f7f0] text-[#9c8b77] group-hover:text-[#d87c4a]'
                                        }`}>
                                        <i className={`fa-solid ${backup.isLatest ? 'fa-database' : 'fa-box-archive'}`}></i>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-[#5c4b37]">{backup.formattedDate}</span>
                                            <span className="text-xs font-mono text-[#9c8b77] bg-[#f0f3e6] px-1.5 py-0.5 rounded">{backup.formattedTime}</span>
                                        </div>
                                        <div className="text-xs text-[#9c8b77] mt-1 flex items-center gap-3">
                                            <span><i className="fa-solid fa-folder-tree mr-1"></i>{(backup.totalItems || 0).toLocaleString()} Items</span>
                                            <span><i className="fa-solid fa-weight-hanging mr-1"></i>{backup.formattedSize}</span>
                                            {backup.name && (
                                                <span className="text-[#5c4b37] font-semibold italic">"{backup.name}"</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Select Action (Radio style) */}
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedBackupId === backup.id
                                        ? 'border-[#88c9a1]'
                                        : 'border-[#d4cdb6] group-hover:border-[#d87c4a]'
                                        }`}>
                                        {selectedBackupId === backup.id && (
                                            <div className="w-3 h-3 bg-[#88c9a1] rounded-full"></div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/*Bottom Fade Decoration */}
                    <div className="h-6 bg-gradient-to-t from-[#fffefb] to-transparent absolute bottom-0 w-full pointer-events-none"></div>
                </div>
            </div>

            {/* LOG BAR */}
            <LogBar
                status={logStatus}
                message={logMessage}
                errorMessage={logError}
                details={{ memory: logStatus === 'ready' ? 'Idle' : null }}
            />
        </div>
    );
};

export default Restorer;

