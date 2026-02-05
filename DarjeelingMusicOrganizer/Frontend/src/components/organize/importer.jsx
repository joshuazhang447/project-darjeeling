import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import LogBar from './LogBar';
import Fuse from 'fuse.js';


const Importer = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [fullTreeData, setFullTreeData] = useState([]);
    const [treeData, setTreeData] = useState([]);
    const [libraryStats, setLibraryStats] = useState({
        exists: false,
        isEmpty: true,
        totalTracks: 0,
        totalSize: '0 B'
    });

    const [logStatus, setLogStatus] = useState('ready');
    const [logMessage, setLogMessage] = useState("Press 'Import/Refresh' to scan directory, update the library structure, and generate a backup point.");
    const [logError, setLogError] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    const [scanPollInterval, setScanPollInterval] = useState(null);

    const flattenTreeForSearch = (tree) => {
        const items = [];

        tree.forEach(artist => {
            //Add artist
            items.push({
                type: 'artist',
                id: artist.id,
                name: artist.name,
                artistId: artist.id,
                artistName: artist.name,
                isSystemFolder: artist.isSystemFolder
            });

            //Add albums
            (artist.children || []).forEach(album => {
                items.push({
                    type: 'album',
                    id: album.id,
                    name: album.name,
                    artistId: artist.id,
                    artistName: artist.name,
                    albumId: album.id,
                    albumName: album.name
                });

                //Add tracks
                (album.children || []).forEach(track => {
                    items.push({
                        type: 'file',
                        id: track.id,
                        name: track.name,
                        title: track.title || '',
                        contributingArtists: track.contributingArtists || '',
                        artistId: artist.id,
                        artistName: artist.name,
                        albumId: album.id,
                        albumName: album.name,
                        trackData: track
                    });
                });
            });
        });

        return items;
    };

    /**
     *Fuse.js  for fuzzy search
     */
    const fuseInstance = useMemo(() => {
        if (fullTreeData.length === 0) return null;

        const flatItems = flattenTreeForSearch(fullTreeData);

        return new Fuse(flatItems, {
            //Keys to search with weights (higher = more important)
            keys: [
                { name: 'name', weight: 0.4 },
                { name: 'title', weight: 0.3 },
                { name: 'contributingArtists', weight: 0.2 },
                { name: 'artistName', weight: 0.1 }
            ],
            //Config

            // 0.0 = exact, 1.0 = match anything (0.35 is balanced)
            threshold: 0.35,
            // How far to search for pattern    
            distance: 100,
            // Match anywhere in string (middle, end, etc.)
            ignoreLocation: true,
            // Include match score
            includeScore: true,
            // Min characters to start matching
            minMatchCharLength: 2,
            // Sort by score
            shouldSort: true,
            // Find all matches, not just first  
            findAllMatches: true
        });
    }, [fullTreeData]);


    //Rebuild tree from search results
    const rebuildTreeFromResults = (results, originalTree) => {
        //Collect all matching IDs by type
        const matchingArtists = new Set();
        const matchingAlbums = new Set();
        const matchingTracks = new Set();

        results.forEach(result => {
            const item = result.item;
            if (item.type === 'artist') {
                matchingArtists.add(item.id);
            } else if (item.type === 'album') {
                matchingArtists.add(item.artistId);
                matchingAlbums.add(item.id);
            } else if (item.type === 'file') {
                matchingArtists.add(item.artistId);
                matchingAlbums.add(item.albumId);
                matchingTracks.add(item.id);
            }
        });

        //Filter and rebuild tree
        return originalTree
            .filter(artist => matchingArtists.has(artist.id))
            .map(artist => ({
                ...artist,
                children: (artist.children || [])
                    .filter(album => matchingAlbums.has(album.id))
                    .map(album => ({
                        ...album,
                        children: (album.children || [])
                            .filter(track => matchingTracks.has(track.id))
                    }))
                    .filter(album => album.children.length > 0 || matchingAlbums.has(album.id))
            }))
            .filter(artist => artist.children.length > 0 || matchingArtists.has(artist.id));
    };

    /**
     * Handle search with debounce
     */
    const handleSearch = useCallback(
        debounce((query) => {
            if (!libraryStats.exists || !fuseInstance) return;

            if (query.trim() === '') {
                setTreeData(fullTreeData);
            } else {
                // Fuzzy search
                const results = fuseInstance.search(query);
                const filteredTree = rebuildTreeFromResults(results, fullTreeData);
                setTreeData(filteredTree);
            }
        }, 150),
        [libraryStats.exists, fuseInstance, fullTreeData]
    );

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    useEffect(() => {
        loadLibraryData();

        return () => {
            // Cleanup polling on unmount
            if (scanPollInterval) {
                clearInterval(scanPollInterval);
            }
        };
    }, []);

    /**
     *Load library data from backend
     */
    const loadLibraryData = async () => {
        try {
            setIsLoading(true);

            //Check if database exists
            const dbCheck = await window.chrome.webview.hostObjects.appBridge.CheckLibraryDatabase();
            const dbStatus = JSON.parse(dbCheck);
            setLibraryStats(dbStatus);

            if (dbStatus.exists) {
                //Load tree data
                const treeJson = await window.chrome.webview.hostObjects.appBridge.GetLibraryTree();
                const tree = JSON.parse(treeJson);
                //Store original for fuzzy search
                setFullTreeData(tree);
                //Display tree
                setTreeData(tree);
            } else {
                setFullTreeData([]);
                setTreeData([]);
            }
        } catch (error) {
            console.error('Error loading library data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     *Handle search input change
     */
    const onSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        handleSearch(query);
    };

    /**
     *Handle Import/Refresh button click
     */
    const handleImportClick = async () => {
        try {
            //Reset previous errors
            setLogError(null);
            setLogStatus('ready');
            setLogMessage('Select your Library folder...');

            //Prompt user to select a folder via native dialog
            const selectedFolder = await window.chrome.webview.hostObjects.appBridge.SelectFolder();

            if (!selectedFolder) {
                //User cancelled the dialog
                setLogMessage("Press 'Import/Refresh' to scan directory, update the library structure, and generate a backup point.");
                return;
            }

            //Validate the folder first
            const validationJson = await window.chrome.webview.hostObjects.appBridge.ValidateLibraryFolder(selectedFolder);
            const validation = JSON.parse(validationJson);

            if (!validation.valid) {
                setLogStatus('error');
                setLogError(validation.message);
                return;
            }

            //Start Scan
            setLogStatus('scanning');
            setLogMessage('Scanning library structure...');

            // Start Async scan
            await window.chrome.webview.hostObjects.appBridge.StartLibraryScan(selectedFolder);

            // Poll for status
            const pollId = setInterval(async () => {
                try {
                    const statusJson = await window.chrome.webview.hostObjects.appBridge.GetScanStatus();
                    const status = JSON.parse(statusJson);

                    if (status.status === 'scanning') {
                        setLogStatus('working');
                        setLogMessage(status.message);
                    } else if (status.status === 'success') {
                        clearInterval(pollId);
                        setScanPollInterval(null);
                        setLogStatus('success');
                        setLogMessage(status.message);


                        await loadLibraryData();

                        //Reset to ready after 5 seconds
                        setTimeout(() => {
                            setLogStatus('ready');
                            setLogMessage("Library imported. Press 'Import/Refresh' to update.");
                            window.chrome.webview.hostObjects.appBridge.ResetScanStatus();
                        }, 5000);
                    } else if (status.status === 'error') {
                        clearInterval(pollId);
                        setScanPollInterval(null);
                        setLogStatus('error');
                        setLogError(status.message);
                        window.chrome.webview.hostObjects.appBridge.ResetScanStatus();
                    }
                } catch (err) {
                    console.error('Poll error:', err);
                }
            }, 500);

            setScanPollInterval(pollId);

        } catch (error) {
            console.error('Import error:', error);
            setLogStatus('error');
            setLogError(error.message || 'An unexpected error occurred');
        }
    };

    /**
     * Format duration from milliseconds
     */
    const formatDuration = (ms) => {
        if (!ms) return null;
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /**
     * Tree Item Component
     */
    const TreeItem = ({ item, indent = 0 }) => {
        const [isOpen, setIsOpen] = useState(true);
        const [showTooltip, setShowTooltip] = useState(false);
        const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
        const itemRef = useRef(null);

        //Handle mouse enter
        const handleMouseEnter = () => {
            if (itemRef.current) {
                const rect = itemRef.current.getBoundingClientRect();
                setTooltipPos({
                    x: rect.left,
                    //4px gap below track
                    y: rect.bottom + 4
                });
            }
            setShowTooltip(true);
        };

        if (item.type === 'file') {
            //Checker for metadata
            const hasMetadata = item.title || item.trackNumber || item.durationMs || item.bitrate || item.contributingArtists;

            return (
                <div
                    ref={itemRef}
                    className="flex items-center gap-2 p-1.5 hover:bg-[#f0f3e6] rounded cursor-default group"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <i className="fa-solid fa-file-audio text-[#9c8b77] text-xs"></i>
                    <span className="font-mono text-[11px] font-semibold text-[#5c4b37]">{item.name}</span>
                    <span className="ml-auto text-[9px] text-[#9c8b77]">{item.size}</span>

                    {/*Tooltip */}
                    {showTooltip && hasMetadata && createPortal(
                        <div
                            className="fixed z-[9999] bg-[#5c4b37] text-white px-3 py-2 rounded-lg shadow-xl text-xs whitespace-nowrap animate-fadeIn pointer-events-none"
                            style={{ left: tooltipPos.x, top: tooltipPos.y }}
                        >
                            <div className="flex flex-col gap-1">
                                {item.title && (
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-music text-[#88c9a1] w-4"></i>
                                        <span className="font-semibold">{item.title}</span>
                                    </div>
                                )}
                                {item.contributingArtists && (
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-user text-[#88c9a1] w-4"></i>
                                        <span className="opacity-90">{item.contributingArtists}</span>
                                    </div>
                                )}
                                <div className="flex gap-3 mt-1 pt-1 border-t border-white/20 text-[10px] opacity-80">
                                    {item.trackNumber && (
                                        <span><i className="fa-solid fa-hashtag mr-1"></i>{item.trackNumber}</span>
                                    )}
                                    {item.durationMs && (
                                        <span><i className="fa-solid fa-clock mr-1"></i>{formatDuration(item.durationMs)}</span>
                                    )}
                                    {item.bitrate && (
                                        <span><i className="fa-solid fa-signal mr-1"></i>{item.bitrate} kbps</span>
                                    )}
                                </div>
                            </div>
                            {/*Tooltip Arrow */}
                            <div className="absolute left-4 top-0 -mt-1 w-2 h-2 bg-[#5c4b37] rotate-45"></div>
                        </div>,
                        document.body
                    )}
                </div>
            );
        }

        return (
            <div className="group">
                <div
                    className="flex items-center gap-2 p-1.5 hover:bg-[#f0f3e6] rounded cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'right'} text-[10px] text-[#9c8b77] w-4 text-center`}></i>
                    <i className={`fa-solid ${item.isSystemFolder ? 'fa-users' :
                        item.type === 'artist' ? 'fa-user-tag' : 'fa-compact-disc'
                        } ${item.isSystemFolder ? 'text-[#eebb4d]' : 'text-[#9c8b77]'} ${item.type === 'album' ? 'text-xs' : ''}`}></i>
                    <span className={`font-bold ${item.type === 'artist' ? 'text-sm' : 'text-xs'} text-[#5c4b37]`}>{item.name}</span>
                </div>

                {isOpen && item.children && item.children.length > 0 && (
                    <div className="pl-2 ml-2 border-left-dotted border-l-2 border-[#e8e3d3]">
                        {item.children.map(child => (
                            <TreeItem key={`${child.type}-${child.id}`} item={child} indent={indent + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    /**
     *Empty State Component - No database exists
     */
    const EmptyState = () => (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-[#f0f3e6] rounded-full flex items-center justify-center mb-6 border-4 border-[#e8e3d3]">
                <i className="fa-solid fa-folder-open text-4xl text-[#d4cdb6]"></i>
            </div>
            <h3 className="text-xl font-bold text-[#5c4b37] mb-2">Library Not Yet Imported</h3>
            <p className="text-sm text-[#9c8b77] max-w-md mb-4">
                Your music library hasn't been scanned yet. Press the <strong>"Import Library"</strong> button above
                to scan your collection folder and build the database index.
            </p>
            <p className="text-xs text-[#d4cdb6] italic">
                This allows for fast searching and organized playback.
            </p>
        </div>
    );

    /**
     *Empty Library State Component - Database exists but no songs
     */
    const EmptyLibraryState = () => (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-[#fff8e6] rounded-full flex items-center justify-center mb-6 border-4 border-[#eebb4d]/30">
                <i className="fa-solid fa-music text-4xl text-[#eebb4d]"></i>
            </div>
            <h3 className="text-xl font-bold text-[#5c4b37] mb-2">Empty Library</h3>
            <p className="text-sm text-[#9c8b77] max-w-md mb-4">
                Your library folder is empty. Head over to the <strong>Organizer</strong> tab
                to add and organize your music collection.
            </p>
            <p className="text-xs text-[#88c9a1] font-semibold">
                <i className="fa-solid fa-arrow-right mr-2"></i>
                Go to Organizer to get started!
            </p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#e8e3d3]/30">

            {/*SCROLLABLE MAIN CONTENT */}
            <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">

                {/*1. BIG ACTION BUTTON */}
                <div className="shrink-0 flex justify-center pt-2">
                    <button
                        className="group bg-[#5c4b37] text-white w-full max-w-md py-4 rounded-xl font-bold shadow-[0_6px_0_#3e3224] hover:shadow-[0_3px_0_#3e3224] hover:translate-y-[3px] transition-all active:shadow-none active:translate-y-[6px] flex items-center justify-center gap-5 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleImportClick}
                        disabled={logStatus === 'scanning' || logStatus === 'working'}
                    >
                        {/*Animated Icon Container */}
                        <div className={`w-12 h-12 bg-[#88c9a1] rounded-full flex items-center justify-center text-[#fffefb] transition-transform duration-500 shadow-inner border-2 border-[#5c4b37]/20 ${(logStatus === 'scanning' || logStatus === 'working') ? 'animate-spin' : 'group-hover:rotate-180'
                            }`}>
                            <i className="fa-solid fa-arrows-rotate text-2xl"></i>
                        </div>

                        {/*Text Stack */}
                        <div className="flex flex-col items-start text-left">
                            <span className="text-xl font-extrabold tracking-wide">IMPORT LIBRARY</span>
                            <span className="text-[11px] text-[#d4cdb6] font-semibold uppercase tracking-wider opacity-90">Scan Disk & Update Database</span>
                        </div>
                    </button>
                </div>

                {/* 2. TREE STRUCTURE PANEL */}
                <div className="flex-1 bg-[#fffefb] rounded-2xl border-4 border-[#e8e3d3] flex flex-col overflow-hidden shadow-sm max-w-5xl w-full mx-auto relative min-h-[300px]">

                    {/* Header with Stats */}
                    <div className="p-3 border-b border-[#e8e3d3] bg-[#fcfbf9] flex justify-between items-center shrink-0">
                        <div className="font-extrabold text-[#5c4b37] uppercase tracking-wide text-xs flex items-center gap-2">
                            <i className="fa-solid fa-hard-drive text-[#9c8b77]"></i>
                            Current Disk State
                        </div>

                        {/* Total Size Display */}
                        <div className="flex gap-4 text-[11px] font-bold text-[#9c8b77] bg-[#f0f3e6] px-3 py-1 rounded-lg border border-[#e8e3d3]">
                            <span className="text-[#5c4b37]">
                                <i className="fa-solid fa-weight-hanging mr-1 opacity-50"></i>
                                {libraryStats.totalSize || '0 B'}
                            </span>
                            <span className="text-[#d4cdb6]">|</span>
                            <span className="text-[#5c4b37]">
                                <i className="fa-solid fa-layer-group mr-1 opacity-50"></i>
                                {(libraryStats.totalTracks || 0).toLocaleString()} Items
                            </span>
                        </div>
                    </div>

                    {/* Search Bar */}
                    {libraryStats.exists && (
                        <div className="px-3 py-2 bg-[#fcfbf9] border-b border-dotted border-[#e8e3d3] shrink-0">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-[#9c8b77] text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Search Library..."
                                    value={searchQuery}
                                    onChange={onSearchChange}
                                    className="w-full bg-white border border-[#e8e3d3] rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-[#5c4b37] placeholder-[#d4cdb6] focus:outline-none focus:ring-2 focus:ring-[#88c9a1]/30 focus:border-[#88c9a1] transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/*Tree Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {isLoading ? (
                            <div className="flex-1 flex items-center justify-center p-8">
                                <i className="fa-solid fa-spinner animate-spin text-2xl text-[#9c8b77]"></i>
                            </div>
                        ) : !libraryStats.exists ? (
                            <EmptyState />
                        ) : libraryStats.isEmpty ? (
                            <EmptyLibraryState />
                        ) : treeData.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center p-8 text-[#9c8b77]">
                                {searchQuery ? 'No results found' : 'Library is empty'}
                            </div>
                        ) : (
                            <>
                                {/* Regular artists */}
                                {treeData.filter(a => !a.isSystemFolder).map(artist => (
                                    <TreeItem key={`artist-${artist.id}`} item={artist} />
                                ))}

                                {/* Special Folder: Multiple_Artists */}
                                {treeData.filter(a => a.isSystemFolder).map(artist => (
                                    <div key={`system-${artist.id}`} className="mt-4 pt-2 border-t border-dotted border-[#e8e3d3]">
                                        <TreeItem item={artist} />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/*Bottom Fade  */}
                    <div className="h-6 bg-gradient-to-t from-[#fffefb] to-transparent absolute bottom-0 w-full pointer-events-none"></div>

                </div>

            </div>

            {/*LOG BAR */}
            <LogBar
                status={logStatus}
                message={logMessage}
                errorMessage={logError}
                details={{ memory: logStatus === 'ready' ? 'Idle' : null }}
            />

        </div>
    );
};

export default Importer;
