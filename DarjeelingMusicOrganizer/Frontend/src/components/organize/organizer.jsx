import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Fuse from 'fuse.js';
import LogBar from './LogBar';

const Organizer = () => {
    // Tab State: 'sorting' or 'conflicts'
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('sorting');

    // Dynamic Library tree states
    const [fullLibraryTree, setFullLibraryTree] = useState([]);
    const [libraryTree, setLibraryTree] = useState([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [libraryStats, setLibraryStats] = useState({ exists: false, isEmpty: true });

    // Interactive Action Flow States
    const [dupeCheckDone, setDupeCheckDone] = useState(false);
    const [organizeDone, setOrganizeDone] = useState(false);
    const [applied, setApplied] = useState(false);

    // Busy Simulation States
    const [isCheckingDupes, setIsCheckingDupes] = useState(false);
    const [isOrganizing, setIsOrganizing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Logs
    const [logStatus, setLogStatus] = useState('ready');
    const [logMessage, setLogMessage] = useState('Select "Check for Duplicates" to begin organizing.');
    const [logError, setLogError] = useState(null);

    // Search and View states
    const [inboxSearch, setInboxSearch] = useState('');
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryView, setLibraryView] = useState('current'); // 'current', 'planned', 'full'
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Dynamic Inbox scan states
    const [fullInboxItems, setFullInboxItems] = useState([]);
    const [inboxItems, setInboxItems] = useState([]);
    const [totalInboxFiles, setTotalInboxFiles] = useState(0);
    const [isLoadingInbox, setIsLoadingInbox] = useState(true);

    // Collapsed/Expanded Tree Nodes State
    const [expandedNodes, setExpandedNodes] = useState({
        'folder-multiple-artist': true
    });

    const toggleNode = (nodeId) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: !prev[nodeId]
        }));
    };

    // Load Inbox Data from Local C# Bridge
    const loadInboxData = async () => {
        try {
            setIsLoadingInbox(true);
            setLogStatus('scanning');
            setLogMessage('Scanning inbox folder (Collection/New)...');
            setLogError(null);

            if (window.chrome?.webview?.hostObjects?.appBridge) {
                const resultJson = await window.chrome.webview.hostObjects.appBridge.ScanInbox();
                const result = JSON.parse(resultJson);

                if (result.status === 'success') {
                    setFullInboxItems(result.items || []);
                    setInboxItems(result.items || []);
                    setTotalInboxFiles(result.totalFiles || 0);
                    setLogStatus('ready');
                    setLogMessage(`Scanned ${result.totalFiles} files in inbox. Select "Check for Duplicates" to begin.`);
                } else if (result.status === 'empty') {
                    setFullInboxItems([]);
                    setInboxItems([]);
                    setTotalInboxFiles(0);
                    setLogStatus('error');
                    setLogError('No files to organize. Please place audio files in the New folder.');
                } else if (result.status === 'not_configured') {
                    setFullInboxItems([]);
                    setInboxItems([]);
                    setTotalInboxFiles(0);
                    setLogStatus('error');
                    setLogError('Collection path is not configured. Please complete settings first.');
                } else {
                    setFullInboxItems([]);
                    setInboxItems([]);
                    setTotalInboxFiles(0);
                    setLogStatus('error');
                    setLogError(result.message || 'Error scanning inbox.');
                }
            } else {
                // Fallback for standalone web development/debugging
                setTimeout(() => {
                    const mockInbox = [
                        {
                            id: 'dj_feralcat',
                            name: 'dj_feralcat',
                            type: 'folder',
                            relativePath: 'dj_feralcat',
                            children: [
                                {
                                    id: 'feral-track-1',
                                    name: '01_final_FINAL2.wav',
                                    type: 'file',
                                    relativePath: 'dj_feralcat/01_final_FINAL2.wav',
                                    size: '42.1 MB'
                                }
                            ]
                        },
                        {
                            id: 'loose-1',
                            name: 'taxi ride home 4_44am.mp3',
                            type: 'file',
                            relativePath: 'taxi ride home 4_44am.mp3',
                            size: '8.4 MB'
                        },
                        {
                            id: 'loose-2',
                            name: 'track (1).mp3',
                            type: 'file',
                            relativePath: 'track (1).mp3',
                            size: '5.2 MB'
                        }
                    ];
                    setFullInboxItems(mockInbox);
                    setInboxItems(mockInbox);
                    setTotalInboxFiles(3);
                    setLogStatus('ready');
                    setLogMessage('Scanned 3 files in inbox. Select "Check for Duplicates" to begin.');
                }, 1000);
            }
        } catch (error) {
            console.error('Error scanning inbox:', error);
            setLogStatus('error');
            setLogError('Failed to scan inbox directory.');
        } finally {
            setIsLoadingInbox(false);
        }
    };

    // Load Library tree data from Local C# Bridge
    const loadLibraryTreeData = async () => {
        try {
            setIsLoadingLibrary(true);
            if (window.chrome?.webview?.hostObjects?.appBridge) {
                // Check if database exists
                const dbCheck = await window.chrome.webview.hostObjects.appBridge.CheckLibraryDatabase();
                const dbStatus = JSON.parse(dbCheck);
                setLibraryStats(dbStatus);

                if (dbStatus.exists) {
                    const treeJson = await window.chrome.webview.hostObjects.appBridge.GetLibraryTree();
                    const tree = JSON.parse(treeJson);
                    setFullLibraryTree(tree || []);
                    setLibraryTree(tree || []);
                } else {
                    setFullLibraryTree([]);
                    setLibraryTree([]);
                }
            } else {
                // Fallback for standalone web development/debugging
                const mockStats = { exists: true, isEmpty: false, totalSize: "18.6 MB", totalTracks: 2 };
                setLibraryStats(mockStats);
                const mockTree = [
                    {
                        id: 1,
                        type: 'artist',
                        name: 'Daft Punk',
                        isSystemFolder: false,
                        children: [
                            {
                                id: 2,
                                type: 'album',
                                name: 'Discovery',
                                children: [
                                    { id: 3, type: 'file', name: '01 One More Time.mp3', size: '10.2 MB', durationMs: 320000, bitrate: 320, title: 'One More Time', contributingArtists: 'Daft Punk' },
                                    { id: 4, type: 'file', name: '02 Aerodynamic.mp3', size: '8.4 MB', durationMs: 212000, bitrate: 320, title: 'Aerodynamic', contributingArtists: 'Daft Punk' }
                                ]
                            }
                        ]
                    },
                    {
                        id: 5,
                        type: 'artist',
                        name: 'The Beatles',
                        isSystemFolder: false,
                        children: []
                    },
                    {
                        id: 6,
                        type: 'artist',
                        name: 'Multiple_Artist',
                        isSystemFolder: true,
                        children: []
                    }
                ];
                setFullLibraryTree(mockTree);
                setLibraryTree(mockTree);
            }
        } catch (error) {
            console.error('Error loading library tree data:', error);
        } finally {
            setIsLoadingLibrary(false);
        }
    };

    useEffect(() => {
        loadInboxData();
        loadLibraryTreeData();
    }, []);

    // Flatten tree structure for Fuse.js search
    const flattenInboxForSearch = (items) => {
        const flat = [];
        const recurse = (list, parentFolder = null) => {
            list.forEach(item => {
                flat.push({
                    id: item.id,
                    type: item.type,
                    name: item.name,
                    relativePath: item.relativePath,
                    parentFolder: parentFolder,
                    itemData: item
                });
                if (item.children && item.children.length > 0) {
                    recurse(item.children, item.name);
                }
            });
        };
        recurse(items);
        return flat;
    };

    // Rebuild tree matching search results
    const rebuildInboxFromResults = (results, originalItems) => {
        const matchingIds = new Set();
        results.forEach(res => {
            matchingIds.add(res.item.id);
        });

        const filterTree = (nodes) => {
            return nodes
                .map(node => {
                    const isMatch = matchingIds.has(node.id);
                    let filteredChildren = [];
                    if (node.children && node.children.length > 0) {
                        filteredChildren = filterTree(node.children);
                    }
                    if (isMatch || filteredChildren.length > 0) {
                        return {
                            ...node,
                            children: filteredChildren
                        };
                    }
                    return null;
                })
                .filter(Boolean);
        };

        return filterTree(originalItems);
    };

    // Fuse.js fuzzy search instance
    const fuseInstance = useMemo(() => {
        if (fullInboxItems.length === 0) return null;
        const flatItems = flattenInboxForSearch(fullInboxItems);
        return new Fuse(flatItems, {
            keys: [
                { name: 'name', weight: 0.8 },
                { name: 'relativePath', weight: 0.4 }
            ],
            threshold: 0.35,
            distance: 100,
            ignoreLocation: true,
            includeScore: true,
            minMatchCharLength: 2,
            shouldSort: true,
            findAllMatches: true
        });
    }, [fullInboxItems]);

    // Debounced search handler
    const handleInboxSearch = useCallback(
        debounce((query) => {
            if (query.trim() === '') {
                setInboxItems(fullInboxItems);
            } else if (fuseInstance) {
                const results = fuseInstance.search(query);
                const filtered = rebuildInboxFromResults(results, fullInboxItems);
                setInboxItems(filtered);
            }
        }, 150),
        [fuseInstance, fullInboxItems]
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

    const onSearchChange = (e) => {
        const query = e.target.value;
        setInboxSearch(query);
        handleInboxSearch(query);
    };

    const getActiveLibraryData = () => {
        if (applied) {
            return libraryTree;
        }

        if (libraryView === 'planned') {
            if (organizeDone) {
                const mergedTree = JSON.parse(JSON.stringify(libraryTree));
                
                // Add planned dj_feralcat
                let feralcatArtist = mergedTree.find(a => a.name === 'dj_feralcat');
                if (!feralcatArtist) {
                    feralcatArtist = {
                        id: 'artist-dj-feralcat',
                        type: 'artist',
                        name: 'dj_feralcat',
                        planned: true,
                        children: []
                    };
                    mergedTree.push(feralcatArtist);
                }
                let feralcatAlbum = feralcatArtist.children.find(al => al.name === 'Feral Cat Single');
                if (!feralcatAlbum) {
                    feralcatAlbum = {
                        id: 'album-feral-cat-single',
                        type: 'album',
                        name: 'Feral Cat Single',
                        planned: true,
                        children: []
                    };
                    feralcatArtist.children.push(feralcatAlbum);
                }
                if (!feralcatAlbum.children.some(s => s.name === '01_final_FINAL2.wav')) {
                    feralcatAlbum.children.push({
                        id: 'song-feral-1',
                        type: 'file',
                        name: '01_final_FINAL2.wav',
                        planned: true,
                        size: '42.1 MB'
                    });
                }

                // Add planned loose files to Multiple_Artist
                let multipleArtistFolder = mergedTree.find(a => a.isSystemFolder || a.name === 'Multiple_Artist');
                if (!multipleArtistFolder) {
                    multipleArtistFolder = {
                        id: 'folder-multiple-artist',
                        type: 'artist',
                        name: 'Multiple_Artist',
                        isSystemFolder: true,
                        children: []
                    };
                    mergedTree.push(multipleArtistFolder);
                }
                if (!multipleArtistFolder.children.some(s => s.name === 'taxi ride home 4_44am.mp3')) {
                    multipleArtistFolder.children.push({
                        id: 'song-loose-1',
                        type: 'file',
                        name: 'taxi ride home 4_44am.mp3',
                        planned: true,
                        size: '8.4 MB'
                    });
                }
                if (!multipleArtistFolder.children.some(s => s.name === 'track (1).mp3')) {
                    multipleArtistFolder.children.push({
                        id: 'song-loose-2',
                        type: 'file',
                        name: 'track (1).mp3',
                        planned: true,
                        size: '5.2 MB'
                    });
                }
                return mergedTree;
            }
        }

        return libraryTree;
    };

    // Flatten library tree structure for Fuse.js search
    const flattenLibraryTreeForSearch = (tree) => {
        const flat = [];
        const recurse = (nodes, artistName = null, albumName = null, artistId = null, albumId = null) => {
            nodes.forEach(node => {
                flat.push({
                    id: node.id,
                    type: node.type,
                    name: node.name,
                    artistName: artistName,
                    albumName: albumName,
                    artistId: artistId,
                    albumId: albumId,
                    isSystemFolder: node.isSystemFolder
                });
                if (node.children && node.children.length > 0) {
                    recurse(
                        node.children,
                        node.type === 'artist' ? node.name : artistName,
                        node.type === 'album' ? node.name : albumName,
                        node.type === 'artist' ? node.id : artistId,
                        node.type === 'album' ? node.id : albumId
                    );
                }
            });
        };
        recurse(tree);
        return flat;
    };

    // Rebuild library tree from search results
    const rebuildLibraryTreeFromResults = (results, originalTree) => {
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
            } else if (item.type === 'file' || item.type === 'song') {
                matchingArtists.add(item.artistId);
                matchingAlbums.add(item.albumId);
                matchingTracks.add(item.id);
            }
        });

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

    // Library Fuse.js instance
    const libraryFuseInstance = useMemo(() => {
        const activeData = getActiveLibraryData();
        if (activeData.length === 0) return null;
        const flatItems = flattenLibraryTreeForSearch(activeData);
        return new Fuse(flatItems, {
            keys: [
                { name: 'name', weight: 0.8 },
                { name: 'artistName', weight: 0.4 },
                { name: 'albumName', weight: 0.4 }
            ],
            threshold: 0.35,
            distance: 100,
            ignoreLocation: true,
            includeScore: true,
            minMatchCharLength: 2,
            shouldSort: true,
            findAllMatches: true
        });
    }, [libraryTree, libraryView, organizeDone, applied]);

    // Progressive workflow actions
    const handleDupeCheck = () => {
        if (dupeCheckDone || isCheckingDupes) return;
        setIsCheckingDupes(true);
        setLogStatus('working');
        setLogError(null);
        setLogMessage('Scanning inbox files for exact duplicates using XXH3 hashing...');

        setTimeout(() => {
            setIsCheckingDupes(false);
            setDupeCheckDone(true);
            setLogStatus('ready');
            setLogMessage(`Duplicate check complete. 0 exact duplicates found in ${totalInboxFiles} files. AI Organizer is now unlocked.`);
        }, 1500);
    };

    const handleAnalyze = () => {
        if (!dupeCheckDone || organizeDone || isOrganizing) return;
        setIsOrganizing(true);
        setLogStatus('working');
        setLogError(null);
        setLogMessage('Analyzing metadata and matching tracks with AI model...');

        setTimeout(() => {
            setIsOrganizing(false);
            setOrganizeDone(true);
            setLibraryView('planned'); // Automatically view planned changes
            setLogStatus('ready');
            setLogMessage('AI organization plan generated. Review proposed library changes on the right, then click Confirm to apply.');
        }, 2000);
    };

    const handleApply = () => {
        if (!organizeDone || applied || isApplying) return;
        setIsApplying(true);
        setLogStatus('working');
        setLogError(null);
        setLogMessage('Moving and renaming files to target folders...');

        setTimeout(async () => {
            setIsApplying(false);
            setApplied(true);
            setLibraryView('current');
            setLogStatus('success');
            setLogMessage(`Successfully organized ${totalInboxFiles} files into library!`);
            await loadLibraryTreeData();
        }, 1500);
    };

    const handleRefresh = () => {
        setDupeCheckDone(false);
        setOrganizeDone(false);
        setApplied(false);
        setLibraryView('current');
        setInboxSearch('');
        setLibrarySearch('');
        loadInboxData();
        loadLibraryTreeData();
    };

    const formatDuration = (ms) => {
        if (!ms) return null;
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const LibraryTreeItem = ({ item }) => {
        const isExpanded = expandedNodes[item.id] !== false; // default expanded
        const [showTooltip, setShowTooltip] = useState(false);
        const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
        const itemRef = useRef(null);

        const handleMouseEnter = () => {
            if (itemRef.current) {
                const rect = itemRef.current.getBoundingClientRect();
                setTooltipPos({
                    x: rect.left,
                    y: rect.bottom + 4
                });
            }
            setShowTooltip(true);
        };

        const hasChildren = item.children && item.children.length > 0;
        const isMultipleArtist = item.isSystemFolder || item.id === 'folder-multiple-artist';

        const handleNodeClick = () => {
            if (hasChildren || isMultipleArtist) {
                toggleNode(item.id);
            }
        };

        const getIcon = () => {
            if (isMultipleArtist) return <i className="fa-solid fa-users text-[#eebb4d]"></i>;
            if (item.type === 'artist') return <i className="fa-solid fa-user-tag text-[#9c8b77]"></i>;
            if (item.type === 'album') return <i className="fa-solid fa-compact-disc text-[#9c8b77] text-xs"></i>;
            return <i className="fa-solid fa-file-audio text-[#9c8b77] text-xs"></i>;
        };

        if (item.type === 'file' || item.type === 'song') {
            const hasMetadata = item.title || item.trackNumber || item.durationMs || item.bitrate || item.contributingArtists;

            return (
                <div
                    ref={itemRef}
                    className="flex items-center gap-2 p-1.5 hover:bg-[#f0f3e6] rounded cursor-default group"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <i className="fa-solid fa-file-audio text-[#9c8b77] text-xs"></i>
                    <span className={`font-mono text-[11px] font-semibold truncate ${item.planned ? 'text-[#88c9a1] font-bold' : 'text-[#5c4b37]'}`}>
                        {item.name}
                    </span>

                    {/* Planned Badge */}
                    {item.planned && (
                        <span className="text-[9px] bg-[#88c9a1]/20 text-[#88c9a1] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider scale-95 origin-left">
                            Planned
                        </span>
                    )}

                    <span className="ml-auto text-[9px] text-[#9c8b77] font-semibold font-mono pr-1">{item.size}</span>

                    {/* Tooltip Portal */}
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
                            <div className="absolute left-4 top-0 -mt-1 w-2 h-2 bg-[#5c4b37] rotate-45"></div>
                        </div>,
                        document.body
                    )}
                </div>
            );
        }

        return (
            <div className={`${isMultipleArtist ? 'mt-4 pt-2 border-t border-dotted border-[#e8e3d3] group relative' : ''}`}>
                <div
                    onClick={handleNodeClick}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition
                        ${isMultipleArtist ? 'bg-[#fcfbf9] border border-[#e8e3d3] hover:bg-[#f0f3e6]' : 'hover:bg-[#f0f3e6]'}
                    `}
                >
                    {/* Chevron */}
                    {(hasChildren || isMultipleArtist) ? (
                        <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-[10px] text-[#9c8b77] w-4 text-center`}></i>
                    ) : (
                        <div className="w-4" />
                    )}

                    {/* Icon */}
                    {getIcon()}

                    {/* Name */}
                    <span className={`font-bold text-sm truncate ${item.planned ? 'text-[#88c9a1] font-bold' : 'text-[#5c4b37]'}`}>
                        {item.name}
                    </span>

                    {/* Planned Badge */}
                    {item.planned && (
                        <span className="text-[9px] bg-[#88c9a1]/20 text-[#88c9a1] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider scale-95 origin-left">
                            Planned
                        </span>
                    )}
                </div>

                {/* Tooltip for Multiple_Artist */}
                {isMultipleArtist && (
                    <div className="meta-tooltip absolute left-10 -top-8 bg-[#5c4b37] text-white p-2 rounded-lg shadow-lg z-50 whitespace-nowrap">
                        <div className="text-[10px] font-bold">System Folder: Always Required</div>
                    </div>
                )}

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div className="pl-2 ml-2 tree-indent">
                        {item.children.map(child => (
                            <LibraryTreeItem key={`${child.type}-${child.id}`} item={child} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Render recursive Library tree items using LibraryTreeItem component
    const renderLibraryTree = (nodes) => {
        return nodes.map(node => (
            <LibraryTreeItem key={`${node.type}-${node.id}`} item={node} />
        ));
    };

    // Render recursive Inbox tree items
    const renderInboxTree = (items) => {
        return items.map(item => {
            const isExpanded = expandedNodes[item.id] !== false; // default expanded
            const hasChildren = item.children && item.children.length > 0;
            const isFolder = item.type === 'folder';

            const handleNodeClick = () => {
                if (isFolder) {
                    toggleNode(item.id);
                }
            };

            const getIcon = () => {
                if (isFolder) {
                    return <i className="fa-solid fa-folder-open text-[#88c9a1]"></i>;
                }
                return <i className="fa-solid fa-file-audio text-[#88c9a1] text-sm"></i>;
            };

            return (
                <div key={item.id} className="group">
                    <div
                        onClick={handleNodeClick}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition text-[#4A5D4E] hover:bg-[#EDF2EC]`}
                    >
                        {/* Chevron */}
                        {isFolder ? (
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[10px] text-[#9c8b77] w-4 text-center`}></i>
                        ) : (
                            <div className="w-4" />
                        )}

                        {/* Icon */}
                        {getIcon()}

                        {/* Name */}
                        <span className={`truncate text-sm ${isFolder ? 'font-bold' : 'font-mono text-xs font-bold text-[#4A5D4E]'}`}>
                            {item.name}
                        </span>

                        {/* Size */}
                        {!isFolder && item.size && (
                            <span className="ml-auto text-[9px] text-[#9c8b77] font-semibold font-mono pr-1">{item.size}</span>
                        )}
                    </div>

                    {/* Children */}
                    {isFolder && hasChildren && isExpanded && (
                        <div className="pl-2 ml-2 tree-indent border-l border-dotted border-[#b0c4b6]/50">
                            {renderInboxTree(item.children)}
                        </div>
                    )}
                </div>
            );
        });
    };

    // Render Inbox Helper
    const renderInbox = () => {
        if (applied) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#f9fbf9] to-[#fffefb]">
                    <div className="w-12 h-12 rounded-full bg-[#88c9a1]/20 text-[#88c9a1] flex items-center justify-center text-xl mb-3">
                        <i className="fa-solid fa-check"></i>
                    </div>
                    <h3 className="font-bold text-[#5c4b37] text-sm">Inbox Organized</h3>
                    <p className="text-[11px] text-[#9c8b77] max-w-[200px] mt-1">All files have been successfully sorted into your music library.</p>
                    <button
                        onClick={handleRefresh}
                        className="mt-4 px-3 py-1.5 text-xs font-bold text-[#5c4b37] bg-[#f0f3e6] border border-[#d4cdb6] rounded-lg hover:bg-[#e8e3d3] transition"
                    >
                        Scan / Refresh Inbox
                    </button>
                </div>
            );
        }

        if (isLoadingInbox) {
            return (
                <div className="flex-1 flex items-center justify-center bg-[#fffefb]">
                    <i className="fa-solid fa-spinner animate-spin text-2xl text-[#9c8b77]"></i>
                </div>
            );
        }

        if (inboxItems.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#f9fbf9] to-[#fffefb]">
                    <div className="w-12 h-12 rounded-full bg-[#e8e3d3] text-[#9c8b77] flex items-center justify-center text-xl mb-3">
                        <i className="fa-solid fa-folder-open"></i>
                    </div>
                    <h3 className="font-bold text-[#5c4b37] text-sm">Inbox is Empty</h3>
                    <p className="text-[11px] text-[#9c8b77] max-w-[200px] mt-1">
                        {logError || 'No files found in the "New" folder.'}
                    </p>
                </div>
            );
        }

        return (
            <div className="flex-1 overflow-y-auto p-2 space-y-1 relative bg-gradient-to-b from-[#f9fbf9] to-[#fffefb]">
                {renderInboxTree(inboxItems)}
            </div>
        );
    };

    // Filter library tree
    const filteredLibraryData = useMemo(() => {
        const activeData = getActiveLibraryData();
        if (!librarySearch.trim()) return activeData;
        if (!libraryFuseInstance) return [];
        const results = libraryFuseInstance.search(librarySearch);
        return rebuildLibraryTreeFromResults(results, activeData);
    }, [librarySearch, libraryFuseInstance, libraryTree, libraryView, organizeDone, applied]);

    // Get color for View dropdown dot
    const getViewDotColor = () => {
        if (libraryView === 'current') return 'bg-[#3b82f6]';
        if (libraryView === 'planned') return 'bg-[#eebb4d]';
        return 'bg-[#88c9a1]';
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#e8e3d3]/30 overflow-hidden">

            {/* 3. CENTER WORKSPACE TABS */}
            <div className="bg-[#e8e3d3]/30 pt-4 pb-2 flex justify-center shrink-0 w-full">
                <div className="flex items-center bg-[#e8e3d3] p-1 rounded-full">
                    {/* Sorting View */}
                    <button
                        onClick={() => setActiveWorkspaceTab('sorting')}
                        className={`px-6 py-1.5 rounded-full text-sm flex items-center gap-2 transition duration-200
                            ${activeWorkspaceTab === 'sorting'
                                ? 'bg-[#fffefb] shadow-sm font-extrabold text-[#5c4b37] border border-[#d4cdb6]'
                                : 'font-bold text-[#9c8b77] hover:text-[#5c4b37]'}`}
                    >
                        <i className={`fa-solid fa-list-ul ${activeWorkspaceTab === 'sorting' ? 'text-[#88c9a1]' : ''}`}></i>
                        Sorting View
                    </button>

                    {/* Conflicts */}
                    <button
                        onClick={() => setActiveWorkspaceTab('conflicts')}
                        className={`px-6 py-1.5 rounded-full text-sm flex items-center gap-2 transition duration-200 ml-1
                            ${activeWorkspaceTab === 'conflicts'
                                ? 'bg-[#fffefb] shadow-sm font-extrabold text-[#5c4b37] border border-[#d4cdb6]'
                                : 'font-bold text-[#9c8b77] hover:text-[#ef5350]'}`}
                    >
                        <i className={`fa-solid fa-triangle-exclamation ${activeWorkspaceTab === 'conflicts' ? 'text-[#ef5350]' : ''}`}></i>
                        Conflicts
                        <span className="bg-[#e8e3d3] text-[#9c8b77] text-[9px] px-1.5 rounded-full border border-[#d4cdb6]">0</span>
                    </button>
                </div>
            </div>

            {/* 4. WORKSPACE CONTENT */}
            {activeWorkspaceTab === 'sorting' ? (
                <div className="flex-1 overflow-hidden px-4 pb-4 grid grid-cols-[1fr_60px_1fr] gap-4 bg-[#e8e3d3]/30 w-full">

                    {/* === LEFT: INBOX === */}
                    <div className="bg-[#fffefb] rounded-2xl border-4 border-[#e8e3d3] flex flex-col overflow-hidden shadow-sm relative">
                        {/* Header */}
                        <div className="p-3 border-b border-[#e8e3d3] bg-[#fcfbf9] flex justify-between items-center">
                            <div className="font-extrabold text-[#4A5D4E] uppercase tracking-wide text-xs flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${applied ? 'bg-[#9c8b77]' : 'bg-[#4A5D4E]'}`}></div>
                                Files to Sort ({applied ? 0 : totalInboxFiles})
                            </div>
                            <button
                                onClick={handleRefresh}
                                title="Rescan Inbox"
                                className="text-[#9c8b77] hover:text-[#4A5D4E] hover:rotate-180 transition duration-300"
                            >
                                <i className="fa-solid fa-arrows-rotate"></i>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2 bg-[#fcfbf9] border-b border-dotted border-[#e8e3d3]">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-[#9c8b77] text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Filter Inbox..."
                                    value={inboxSearch}
                                    onChange={onSearchChange}
                                    disabled={applied || isLoadingInbox}
                                    className="cozy-input w-full bg-white border border-[#e8e3d3] rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-[#4A5D4E] placeholder-[#b0c4b6] disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        {renderInbox()}
                    </div>

                    {/* === MIDDLE: ACTIONS === */}
                    <div className="flex flex-col items-center justify-center gap-6 py-8">
                        {/* DUPE CHECK */}
                        <div className="group relative">
                            <button
                                onClick={handleDupeCheck}
                                disabled={dupeCheckDone || isCheckingDupes || totalInboxFiles === 0}
                                className={`ac-btn w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all z-10 relative
                                    ${!dupeCheckDone
                                        ? 'bg-[#fffefb] border-2 border-[#eebb4d] text-[#eebb4d] hover:bg-[#eebb4d] hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                                        : 'bg-[#88c9a1] border-2 border-[#88c9a1] text-white cursor-default'}`}
                            >
                                {isCheckingDupes ? (
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                ) : dupeCheckDone ? (
                                    <i className="fa-solid fa-check"></i>
                                ) : (
                                    <i className="fa-solid fa-clone"></i>
                                )}
                            </button>
                            <div className="meta-tooltip absolute left-14 top-1/2 -translate-y-1/2 bg-[#5c4b37] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {!dupeCheckDone ? "Check for Duplicates (Required)" : "Duplicates Checked!"}
                            </div>
                        </div>

                        {/* Connector 1 */}
                        <div className={`h-16 w-0.5 border-l-2 border-dotted transition-colors duration-300
                            ${dupeCheckDone ? 'border-[#88c9a1] opacity-60' : 'border-[#9c8b77] opacity-30'}`}
                        />

                        {/* AI ORGANIZE */}
                        <div className="group relative">
                            <button
                                onClick={handleAnalyze}
                                disabled={!dupeCheckDone || organizeDone || isOrganizing}
                                className={`ac-btn w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all z-10 relative
                                    ${(dupeCheckDone && !organizeDone)
                                        ? 'bg-[#fffefb] border-2 border-[#eebb4d] text-[#eebb4d] hover:bg-[#eebb4d] hover:text-white cursor-pointer'
                                        : organizeDone
                                            ? 'bg-[#88c9a1] border-2 border-[#88c9a1] text-white cursor-default'
                                            : 'bg-[#fffefb] border-2 border-[#d4cdb6] text-[#d4cdb6] opacity-40 grayscale cursor-not-allowed'}`}
                            >
                                {isOrganizing ? (
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                ) : organizeDone ? (
                                    <i className="fa-solid fa-check"></i>
                                ) : (
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                )}
                            </button>
                            <div className="meta-tooltip absolute left-14 top-1/2 -translate-y-1/2 bg-[#5c4b37] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {!dupeCheckDone
                                    ? "Perform duplicate check first"
                                    : !organizeDone
                                        ? "Run AI Organizer"
                                        : "Organization Planned!"}
                            </div>
                        </div>

                        {/* Connector 2 */}
                        <div className={`h-16 w-0.5 border-l-2 border-dotted transition-colors duration-300
                            ${organizeDone ? 'border-[#88c9a1] opacity-60' : 'border-[#9c8b77] opacity-30'}`}
                        />

                        {/* APPLY/CONFIRM */}
                        <div className="group relative">
                            <button
                                onClick={handleApply}
                                disabled={!organizeDone || applied || isApplying}
                                className={`ac-btn w-14 h-14 rounded-full text-white flex items-center justify-center text-xl shadow-sm transition-all z-10 relative
                                    ${(organizeDone && !applied)
                                        ? 'bg-[#5c4b37] border-4 border-[#fffefb] hover:bg-[#4A5D4E] cursor-pointer'
                                        : applied
                                            ? 'bg-[#88c9a1] border-4 border-[#fffefb] cursor-default'
                                            : 'bg-[#5c4b37] border-4 border-[#fffefb] opacity-40 grayscale cursor-not-allowed'}`}
                            >
                                {isApplying ? (
                                    <i className="fa-solid fa-spinner animate-spin"></i>
                                ) : (
                                    <i className="fa-solid fa-check"></i>
                                )}
                            </button>
                            <div className="meta-tooltip absolute left-16 top-1/2 -translate-y-1/2 bg-[#5c4b37] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {!organizeDone
                                    ? "Run AI Organizer first"
                                    : !applied
                                        ? "Confirm and Apply Organization"
                                        : "Changes Applied!"}
                            </div>
                        </div>
                    </div>

                    {/* === RIGHT: LIBRARY === */}
                    <div className="bg-[#fffefb] rounded-2xl border-4 border-[#e8e3d3] flex flex-col overflow-hidden shadow-sm relative">
                        {/* Header with Dropdown */}
                        <div className="p-2 border-b border-[#e8e3d3] bg-[#fcfbf9] flex justify-between items-center">

                            {/* View dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#fffefb] border border-[#e8e3d3] rounded-lg hover:border-[#9c8b77] transition font-extrabold text-[#5c4b37] text-xs uppercase tracking-wide shadow-sm"
                                >
                                    <div className={`w-2 h-2 rounded-full ${getViewDotColor()}`}></div>
                                    <span>View: {libraryView}</span>
                                    <i className="fa-solid fa-chevron-down text-[10px] ml-1 opacity-50"></i>
                                </button>

                                {dropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setDropdownOpen(false)}
                                        />
                                        <div className="absolute top-full left-0 mt-2 w-40 bg-[#fffefb] border border-[#e8e3d3] rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div
                                                onClick={() => {
                                                    setLibraryView('current');
                                                    setDropdownOpen(false);
                                                }}
                                                className="px-3 py-2 text-xs font-bold text-[#5c4b37] bg-[#f0f3e6]/50 flex items-center gap-2 cursor-pointer hover:bg-[#e8e3d3] transition"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></div>
                                                Current
                                            </div>
                                            <div
                                                onClick={() => {
                                                    if (!organizeDone) return;
                                                    setLibraryView('planned');
                                                    setDropdownOpen(false);
                                                }}
                                                className={`px-3 py-2 text-xs font-bold flex items-center gap-2 transition
                                                    ${organizeDone 
                                                        ? 'text-[#9c8b77] cursor-pointer hover:bg-[#f0f3e6] hover:text-[#5c4b37]' 
                                                        : 'text-[#d4cdb6] cursor-not-allowed opacity-50'}`}
                                                title={!organizeDone ? "Run AI Organizer to unlock Planned view" : ""}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full bg-[#eebb4d] ${!organizeDone && 'opacity-40'}`}></div>
                                                Planned
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="text-[10px] font-bold text-[#9c8b77]">
                                {applied ? '0 Pending' : organizeDone ? '3 Pending' : '0 Pending'}
                            </div>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2 bg-[#fcfbf9] border-b border-dotted border-[#e8e3d3]">
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-[#9c8b77] text-xs"></i>
                                <input
                                    type="text"
                                    placeholder="Search Library..."
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                    className="cozy-input w-full bg-white border border-[#e8e3d3] rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-[#5c4b37] placeholder-[#d4cdb6]"
                                />
                            </div>
                        </div>

                        {/* CONTENT: Tree Structure */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 relative">
                            {isLoadingLibrary ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <i className="fa-solid fa-spinner animate-spin text-2xl text-[#9c8b77]"></i>
                                </div>
                            ) : !libraryStats.exists ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-16 h-16 bg-[#f0f3e6] rounded-full flex items-center justify-center mb-4 border-2 border-[#e8e3d3]">
                                        <i className="fa-solid fa-folder-open text-2xl text-[#d4cdb6]"></i>
                                    </div>
                                    <h3 className="font-bold text-[#5c4b37] text-xs mb-1">Library Not Yet Imported</h3>
                                    <p className="text-[10px] text-[#9c8b77] max-w-[200px]">
                                        Please import your music library first using the <strong>Importer</strong> tab.
                                    </p>
                                </div>
                            ) : libraryStats.isEmpty ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-16 h-16 bg-[#fff8e6] rounded-full flex items-center justify-center mb-4 border-2 border-[#eebb4d]/30">
                                        <i className="fa-solid fa-music text-2xl text-[#eebb4d]"></i>
                                    </div>
                                    <h3 className="font-bold text-[#5c4b37] text-xs mb-1">Library is Empty</h3>
                                    <p className="text-[10px] text-[#9c8b77] max-w-[200px]">
                                        Your library folder contains no tracks.
                                    </p>
                                </div>
                            ) : filteredLibraryData.length > 0 ? (
                                renderLibraryTree(filteredLibraryData)
                            ) : (
                                <div className="p-8 text-center text-[#9c8b77] text-xs">
                                    {librarySearch ? `No items match "${librarySearch}"` : 'Library is empty'}
                                </div>
                            )}
                        </div>

                        {/* Bottom Fade */}
                        <div className="h-6 bg-gradient-to-t from-[#fffefb] to-transparent absolute bottom-0 w-full pointer-events-none"></div>
                    </div>

                </div>
            ) : (
                /* === CONFLICTS TAB VIEW === */
                <div className="flex-1 overflow-hidden px-4 pb-4 bg-[#e8e3d3]/30 w-full flex flex-col justify-center items-center">
                    <div className="bg-[#fffefb] rounded-2xl border-4 border-[#e8e3d3] p-8 max-w-md w-full text-center shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-[#ef5350]/10 text-[#ef5350] flex items-center justify-center text-2xl mx-auto mb-4">
                            <i className="fa-solid fa-triangle-exclamation animate-bounce"></i>
                        </div>
                        <h3 className="font-extrabold text-[#5c4b37] text-lg">No Conflicts Found</h3>
                        <p className="text-xs text-[#9c8b77] mt-2 leading-relaxed">
                            AI scan indicates all tracks have clean tags and clear organization destinations. No manual conflict resolution is required.
                        </p>
                    </div>
                </div>
            )}

            {/* LOG BAR */}
            <LogBar
                status={logStatus}
                message={logMessage}
                errorMessage={logError}
                details={{
                    memory: isCheckingDupes ? 'Hashing...' : isOrganizing ? 'Planning...' : isApplying ? 'Applying...' : 'Idle'
                }}
            />

        </div>
    );
};

export default Organizer;
