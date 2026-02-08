using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DarjeelingMusicOrganizer
{
    /// <summary>
    ///Manages hash-based snapshots for library backup and restore operations, Uses FNV-1a 64-bit lightweight hashing for file identification.
    /// </summary>
    public static class SnapshotManager
    {
        private const string ManifestFileName = "manifest.json";
        private const string DatabaseFileName = "Current.sqlite3";
        private const int CurrentSnapshotVersion = 2;
        private const int HashBufferSize = 65536;

        #region Models

        public class SnapshotManifest
        {
            public int SnapshotVersion { get; set; }
            public DateTime CreatedAt { get; set; }
            // User-provided snapshot name
            public string Name { get; set; }
            public string DatabaseFile { get; set; }
            public List<SnapshotEntry> Entries { get; set; } = new List<SnapshotEntry>();
            public int TotalEntries { get; set; }
            public long TotalSizeBytes { get; set; }
        }

        public class SnapshotEntry
        {
            public string RelativePath { get; set; }
            //artist, album and track
            public string Type { get; set; } 
            //FNV-1a 64-bit hex (null for the folders)
            public string Hash { get; set; } 
            public long SizeBytes { get; set; }
            public long DateModified { get; set; }
        }

        public class BackupInfo
        {
            public string Id { get; set; }
            public string FolderPath { get; set; }
            public string Name { get; set; } 
            public DateTime CreatedAt { get; set; }
            public string FormattedDate { get; set; }
            public string FormattedTime { get; set; }
            public int TotalItems { get; set; }
            public long TotalSizeBytes { get; set; }
            public string FormattedSize { get; set; }
            public bool IsLatest { get; set; }
            public bool IsValid { get; set; }
        }

        public class RestoreResult
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public int FilesMoved { get; set; }
            public int FilesDeleted { get; set; }
            public int FoldersDeleted { get; set; }
            public int FilesMissing { get; set; }
            public List<string> MissingFiles { get; set; } = new List<string>();
            public string ErrorLogPath { get; set; }
        }

        #endregion

        #region Hash Generation

        /// <summary>
        /// Computes xxHash3 hash of a file for fast, high-quality content identification.
        /// xxHash3 is ~10-20x faster than FNV-1a for large files.
        /// </summary>
        public static string ComputeFileHash(string filePath)
        {
            if (!File.Exists(filePath))
                return null;

            try
            {
                using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, HashBufferSize))
                {
                    var hash = new System.IO.Hashing.XxHash3();
                    byte[] buffer = new byte[HashBufferSize];
                    int bytesRead;
                    
                    while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        hash.Append(buffer.AsSpan(0, bytesRead));
                    }
                    
                    return BitConverter.ToString(hash.GetCurrentHash()).Replace("-", "").ToLowerInvariant();
                }
            }
            catch
            {
                return null;
            }
        }

        #endregion

        #region Snapshot Creation

        /// <summary>
        /// Creates a named snapshot of the library.
        /// </summary>
        public static async Task<string> CreateSnapshot(string libraryPath, string snapshotName = null, IProgress<string> progress = null)
        {
            return await Task.Run(() =>
            {
                try
                {
                    progress?.Report("Preparing snapshot...");

                    if (!Directory.Exists(libraryPath))
                        return null;

                    string collectionPath = Directory.GetParent(libraryPath)?.FullName;
                    if (collectionPath == null) return null;

                    string backupsPath = Path.Combine(collectionPath, "Backups");
                    Directory.CreateDirectory(backupsPath);

                    string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                    string backupFolder = Path.Combine(backupsPath, $"backup_{timestamp}");
                    Directory.CreateDirectory(backupFolder);

                    progress?.Report("Copying database...");

                    //Clear connection pools to flush any pending writes
                    SQLiteConnection.ClearAllPools();
                    GC.Collect();
                    GC.WaitForPendingFinalizers();

                    string dbPath = Path.Combine(libraryPath, DatabaseFileName);
                    if (File.Exists(dbPath))
                    {
                        //Copy main database file
                        File.Copy(dbPath, Path.Combine(backupFolder, DatabaseFileName));
                        
                        //Also copy WAL and SHM files if they exist
                        string walPath = dbPath + "-wal";
                        string shmPath = dbPath + "-shm";
                        if (File.Exists(walPath))
                            File.Copy(walPath, Path.Combine(backupFolder, DatabaseFileName + "-wal"));
                        if (File.Exists(shmPath))
                            File.Copy(shmPath, Path.Combine(backupFolder, DatabaseFileName + "-shm"));
                    }

                    progress?.Report("Generating file hashes...");

                    var manifest = new SnapshotManifest
                    {
                        SnapshotVersion = CurrentSnapshotVersion,
                        CreatedAt = DateTime.UtcNow,
                        Name = string.IsNullOrWhiteSpace(snapshotName) ? null : snapshotName.Trim(),
                        DatabaseFile = DatabaseFileName,
                        Entries = new List<SnapshotEntry>()
                    };

                    long totalSize = 0;
                    int fileCount = 0;

                    var artistDirs = Directory.GetDirectories(libraryPath);
                    int totalArtists = artistDirs.Length;
                    int processedArtists = 0;

                    foreach (var artistDir in artistDirs)
                    {
                        string artistName = Path.GetFileName(artistDir);
                        processedArtists++;
                        progress?.Report($"Processing: {artistName} ({processedArtists}/{totalArtists})");

                        manifest.Entries.Add(new SnapshotEntry
                        {
                            RelativePath = artistName,
                            Type = "artist",
                            Hash = null,
                            SizeBytes = 0,
                            DateModified = new DateTimeOffset(Directory.GetLastWriteTimeUtc(artistDir)).ToUnixTimeSeconds()
                        });

                        foreach (var albumDir in Directory.GetDirectories(artistDir))
                        {
                            string albumName = Path.GetFileName(albumDir);
                            string albumRelPath = Path.Combine(artistName, albumName);

                            manifest.Entries.Add(new SnapshotEntry
                            {
                                RelativePath = albumRelPath,
                                Type = "album",
                                Hash = null,
                                SizeBytes = 0,
                                DateModified = new DateTimeOffset(Directory.GetLastWriteTimeUtc(albumDir)).ToUnixTimeSeconds()
                            });

                            foreach (var trackFile in Directory.GetFiles(albumDir))
                            {
                                var fileInfo = new FileInfo(trackFile);
                                string trackRelPath = Path.Combine(albumRelPath, fileInfo.Name);
                                string hash = ComputeFileHash(trackFile);

                                manifest.Entries.Add(new SnapshotEntry
                                {
                                    RelativePath = trackRelPath,
                                    Type = "track",
                                    Hash = hash,
                                    SizeBytes = fileInfo.Length,
                                    DateModified = new DateTimeOffset(fileInfo.LastWriteTimeUtc).ToUnixTimeSeconds()
                                });

                                totalSize += fileInfo.Length;
                                fileCount++;
                            }
                        }
                    }

                    manifest.TotalEntries = fileCount;
                    manifest.TotalSizeBytes = totalSize;

                    progress?.Report("Saving manifest...");

                    string manifestPath = Path.Combine(backupFolder, ManifestFileName);
                    var options = new JsonSerializerOptions { WriteIndented = true };
                    File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, options));

                    progress?.Report("Snapshot created successfully.");
                    return backupFolder;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"CreateSnapshot error: {ex.Message}");
                    return null;
                }
            });
        }

        #endregion

        #region List Backups

        public static List<BackupInfo> GetAvailableBackups(string collectionPath)
        {
            var backups = new List<BackupInfo>();

            try
            {
                string backupsPath = Path.Combine(collectionPath, "Backups");
                if (!Directory.Exists(backupsPath))
                    return backups;

                var backupDirs = Directory.GetDirectories(backupsPath, "backup_*")
                    .OrderByDescending(d => d)
                    .ToList();

                for (int i = 0; i < backupDirs.Count; i++)
                {
                    var dir = backupDirs[i];
                    string manifestPath = Path.Combine(dir, ManifestFileName);

                    var info = new BackupInfo
                    {
                        Id = Path.GetFileName(dir),
                        FolderPath = dir,
                        IsLatest = (i == 0),
                        IsValid = File.Exists(manifestPath)
                    };

                    if (info.IsValid)
                    {
                        try
                        {
                            var manifest = JsonSerializer.Deserialize<SnapshotManifest>(File.ReadAllText(manifestPath));
                            info.Name = manifest.Name;
                            info.CreatedAt = manifest.CreatedAt;
                            info.FormattedDate = manifest.CreatedAt.ToLocalTime().ToString("MMM dd, yyyy");
                            info.FormattedTime = manifest.CreatedAt.ToLocalTime().ToString("HH:mm:ss");
                            info.TotalItems = manifest.TotalEntries;
                            info.TotalSizeBytes = manifest.TotalSizeBytes;
                            info.FormattedSize = FormatBytes(manifest.TotalSizeBytes);
                        }
                        catch
                        {
                            info.IsValid = false;
                        }
                    }

                    if (info.CreatedAt == default)
                    {
                        string folderName = Path.GetFileName(dir);
                        if (folderName.StartsWith("backup_") && DateTime.TryParseExact(
                            folderName.Substring(7), "yyyy-MM-dd_HH-mm-ss",
                            null, System.Globalization.DateTimeStyles.None, out var parsedDate))
                        {
                            info.CreatedAt = parsedDate;
                            info.FormattedDate = parsedDate.ToString("MMM dd, yyyy");
                            info.FormattedTime = parsedDate.ToString("HH:mm:ss");
                        }
                    }

                    backups.Add(info);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"GetAvailableBackups error: {ex.Message}");
            }

            return backups;
        }

        #endregion

        #region Restore

        /// <summary>
        /// Performs a TRUE state restoration - the library will exactly match the snapshot.
        /// This includes deleting files/folders that didn't exist in the snapshot.
        /// </summary>
        public static async Task<RestoreResult> RestoreSnapshot(string backupFolder, string libraryPath, IProgress<string> progress = null)
        {
            return await Task.Run(() =>
            {
                var result = new RestoreResult { Success = false };
                var missingFiles = new List<string>();
                var log = new StringBuilder();

                try
                {
                    log.AppendLine($"=== RESTORE LOG ===");
                    log.AppendLine($"Time: {DateTime.Now}");
                    log.AppendLine($"Backup: {backupFolder}");
                    log.AppendLine($"Library: {libraryPath}");
                    log.AppendLine();

                    progress?.Report("Reading snapshot manifest...");

                    string manifestPath = Path.Combine(backupFolder, ManifestFileName);
                    if (!File.Exists(manifestPath))
                    {
                        result.Message = "Manifest file not found.";
                        return result;
                    }

                    var manifest = JsonSerializer.Deserialize<SnapshotManifest>(File.ReadAllText(manifestPath));
                    log.AppendLine($"Manifest: {manifest.TotalEntries} tracks, version {manifest.SnapshotVersion}");

                    //STEP 1: Build expected state from manifest
                    progress?.Report("Building expected state...");

                    var expectedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    var expectedFolders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    var tracksByHash = new Dictionary<string, SnapshotEntry>();

                    foreach (var entry in manifest.Entries)
                    {
                        string fullPath = Path.Combine(libraryPath, entry.RelativePath);

                        if (entry.Type == "track")
                        {
                            expectedPaths.Add(fullPath);
                            if (!string.IsNullOrEmpty(entry.Hash))
                            {
                                tracksByHash[entry.Hash] = entry;
                            }
                        }
                        else
                        {
                            expectedFolders.Add(fullPath);
                        }
                    }

                    log.AppendLine($"Expected: {expectedPaths.Count} files, {expectedFolders.Count} folders");

                    //STEP 2: Index current files by hash
                    progress?.Report("Indexing current files...");

                    var currentFilesByHash = new Dictionary<string, string>();
                    var allCurrentFiles = new List<string>();

                    try
                    {
                        allCurrentFiles = Directory.GetFiles(libraryPath, "*", SearchOption.AllDirectories)
                            .Where(f => !Path.GetFileName(f).Equals(DatabaseFileName, StringComparison.OrdinalIgnoreCase))
                            .ToList();
                    }
                    catch { }

                    foreach (var file in allCurrentFiles)
                    {
                        string hash = ComputeFileHash(file);
                        if (hash != null && !currentFilesByHash.ContainsKey(hash))
                        {
                            currentFilesByHash[hash] = file;
                        }
                    }

                    log.AppendLine($"Indexed: {currentFilesByHash.Count} unique hashes from {allCurrentFiles.Count} files");

                    //STEP 2.5: PRE-VALIDATION - Check if all required files exist
                    progress?.Report("Validating files...");
                    
                    var unavailableFiles = new List<string>();
                    
                    foreach (var entry in manifest.Entries.Where(e => e.Type == "track"))
                    {
                        string expectedPath = Path.Combine(libraryPath, entry.RelativePath);
                        
                        // Check if file exists at expected location with correct hash
                        if (File.Exists(expectedPath))
                        {
                            string currentHash = ComputeFileHash(expectedPath);
                            if (currentHash == entry.Hash)
                            {
                                continue; // File is correct
                            }
                        }
                        
                        // Check if file can be found anywhere by hash
                        if (!string.IsNullOrEmpty(entry.Hash) && currentFilesByHash.ContainsKey(entry.Hash))
                        {
                            continue; // File exists somewhere
                        }
                        
                        // File is missing and cannot be found
                        unavailableFiles.Add(entry.RelativePath);
                    }
                    
                    if (unavailableFiles.Count > 0)
                    {
                        log.AppendLine($"VALIDATION FAILED: {unavailableFiles.Count} files missing");
                        foreach (var file in unavailableFiles.Take(10))
                        {
                            log.AppendLine($"  Missing: {file}");
                        }
                        if (unavailableFiles.Count > 10)
                        {
                            log.AppendLine($"  ... and {unavailableFiles.Count - 10} more");
                        }
                        
                        WriteLog(log.ToString(), "restore_validation_failed");
                        
                        result.Success = false;
                        result.FilesMissing = unavailableFiles.Count;
                        result.MissingFiles = unavailableFiles;
                        result.Message = $"Cannot restore: {unavailableFiles.Count} song(s) are permanently deleted and cannot be recovered. Backup is not restorable.";
                        return result;
                    }
                    
                    log.AppendLine("Validation passed: All required files found.");

                    //STEP 3: Create all required folders
                    progress?.Report("Creating folder structure...");

                    foreach (var folderPath in expectedFolders.OrderBy(f => f.Length))
                    {
                        if (!Directory.Exists(folderPath))
                        {
                            Directory.CreateDirectory(folderPath);
                            log.AppendLine($"Created folder: {folderPath}");
                        }
                    }

                    //STEP 4: Move/restore files to correct locations
                    progress?.Report("Restoring files...");

                    int movedCount = 0;
                    int alreadyCorrect = 0;

                    foreach (var entry in manifest.Entries.Where(e => e.Type == "track"))
                    {
                        string expectedPath = Path.Combine(libraryPath, entry.RelativePath);

                        // Check if file already exists at correct location with correct hash
                        if (File.Exists(expectedPath))
                        {
                            string currentHash = ComputeFileHash(expectedPath);
                            if (currentHash == entry.Hash)
                            {
                                alreadyCorrect++;
                                continue;
                            }
                        }

                        // Find the file by hash anywhere in the library
                        if (!string.IsNullOrEmpty(entry.Hash) && currentFilesByHash.TryGetValue(entry.Hash, out string currentPath))
                        {
                            if (!string.Equals(currentPath, expectedPath, StringComparison.OrdinalIgnoreCase))
                            {
                                try
                                {
                                    // Make sure target directory exists
                                    Directory.CreateDirectory(Path.GetDirectoryName(expectedPath));

                                    // Remove any file that's blocking the target
                                    if (File.Exists(expectedPath))
                                    {
                                        File.Delete(expectedPath);
                                    }

                                    // Move the file
                                    File.Move(currentPath, expectedPath);
                                    movedCount++;
                                    log.AppendLine($"Moved: {Path.GetFileName(currentPath)} -> {entry.RelativePath}");

                                    // Update our tracking
                                    currentFilesByHash[entry.Hash] = expectedPath;
                                }
                                catch (Exception ex)
                                {
                                    log.AppendLine($"Move FAILED: {entry.RelativePath} - {ex.Message}");
                                    missingFiles.Add($"{entry.RelativePath} (move failed)");
                                }
                            }
                            else
                            {
                                alreadyCorrect++;
                            }
                        }
                        else
                        {
                            missingFiles.Add(entry.RelativePath);
                            log.AppendLine($"MISSING: {entry.RelativePath}");
                        }
                    }

                    log.AppendLine($"Files: {alreadyCorrect} correct, {movedCount} moved, {missingFiles.Count} missing");

                    //STEP 5: Delete files that shouldn't exist
                    progress?.Report("Removing extra files...");

                    int filesDeleted = 0;

                    //Re-scan to get current state after moves
                    var currentFiles = new List<string>();
                    try
                    {
                        currentFiles = Directory.GetFiles(libraryPath, "*", SearchOption.AllDirectories)
                            .Where(f => !Path.GetFileName(f).Equals(DatabaseFileName, StringComparison.OrdinalIgnoreCase))
                            .ToList();
                    }
                    catch { }

                    foreach (var file in currentFiles)
                    {
                        if (!expectedPaths.Contains(file))
                        {
                            try
                            {
                                File.Delete(file);
                                filesDeleted++;
                                log.AppendLine($"Deleted file: {file}");
                            }
                            catch (Exception ex)
                            {
                                log.AppendLine($"Delete FAILED: {file} - {ex.Message}");
                            }
                        }
                    }

                    //STEP 6: Delete empty folders that shouldn't exist
                    progress?.Report("Cleaning up folders...");

                    int foldersDeleted = 0;

                    //Get all current folders, sorted by depth (deepest first for safe deletion)
                    var currentFolders = new List<string>();
                    try
                    {
                        currentFolders = Directory.GetDirectories(libraryPath, "*", SearchOption.AllDirectories)
                            .OrderByDescending(d => d.Count(c => c == Path.DirectorySeparatorChar))
                            .ToList();
                    }
                    catch { }

                    foreach (var folder in currentFolders)
                    {
                        // Skip if this folder should exist
                        if (expectedFolders.Contains(folder))
                            continue;

                        // Only delete if empty (files may have been deleted above)
                        try
                        {
                            if (Directory.Exists(folder) && !Directory.EnumerateFileSystemEntries(folder).Any())
                            {
                                Directory.Delete(folder);
                                foldersDeleted++;
                                log.AppendLine($"Deleted folder: {folder}");
                            }
                        }
                        catch { }
                    }

                    //STEP 7: Restore database
                    progress?.Report("Restoring database...");

                    string dbBackupPath = Path.Combine(backupFolder, DatabaseFileName);
                    string dbTargetPath = Path.Combine(libraryPath, DatabaseFileName);

                    if (File.Exists(dbBackupPath))
                    {
                        // CRITICAL: Clear SQLite connection pools before replacing the database file
                        // This ensures cached connections don't hold onto the old file
                        SQLiteConnection.ClearAllPools();
                        GC.Collect();
                        GC.WaitForPendingFinalizers();

                        // Delete old database and journal files
                        if (File.Exists(dbTargetPath))
                            File.Delete(dbTargetPath);
                        if (File.Exists(dbTargetPath + "-wal"))
                            File.Delete(dbTargetPath + "-wal");
                        if (File.Exists(dbTargetPath + "-shm"))
                            File.Delete(dbTargetPath + "-shm");
                        if (File.Exists(dbTargetPath + "-journal"))
                            File.Delete(dbTargetPath + "-journal");

                        // Copy main database file
                        File.Copy(dbBackupPath, dbTargetPath);
                        
                        // Copy WAL and SHM files if they exist in backup
                        string walBackup = dbBackupPath + "-wal";
                        string shmBackup = dbBackupPath + "-shm";
                        if (File.Exists(walBackup))
                            File.Copy(walBackup, dbTargetPath + "-wal");
                        if (File.Exists(shmBackup))
                            File.Copy(shmBackup, dbTargetPath + "-shm");
                            
                        log.AppendLine("Database restored.");
                    }

                    // DONE
                    WriteLog(log.ToString(), "restore");

                    if (missingFiles.Count > 0)
                    {
                        result.ErrorLogPath = WriteErrorLog(missingFiles, backupFolder);
                    }

                    //STEP 8: Update backup timestamp to become "latest"
                    try
                    {
                        progress?.Report("Updating backup timestamp...");
                        
                        var newTimestamp = DateTime.Now;
                        var newFolderName = $"backup_{newTimestamp:yyyy-MM-dd_HH-mm-ss}";
                        var parentDir = Path.GetDirectoryName(backupFolder);
                        var newFolderPath = Path.Combine(parentDir, newFolderName);
                        
                        // Update manifest with new timestamp
                        string updateManifestPath = Path.Combine(backupFolder, ManifestFileName);
                        if (File.Exists(updateManifestPath))
                        {
                            string manifestJson = File.ReadAllText(updateManifestPath);
                            var manifestOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                            var updatedManifest = JsonSerializer.Deserialize<SnapshotManifest>(manifestJson, manifestOptions);
                            updatedManifest.CreatedAt = newTimestamp.ToUniversalTime();
                            
                            string newManifestJson = JsonSerializer.Serialize(updatedManifest, new JsonSerializerOptions { WriteIndented = true });
                            File.WriteAllText(updateManifestPath, newManifestJson);
                        }
                        
                        // Rename folder to new timestamp
                        if (!Directory.Exists(newFolderPath))
                        {
                            Directory.Move(backupFolder, newFolderPath);
                            log.AppendLine($"Renamed backup folder to: {newFolderName}");
                        }
                    }
                    catch (Exception ex)
                    {
                        log.AppendLine($"Warning: Could not update backup timestamp: {ex.Message}");
                    }

                    result.Success = true;
                    result.FilesMoved = movedCount;
                    result.FilesDeleted = filesDeleted;
                    result.FoldersDeleted = foldersDeleted;
                    result.FilesMissing = missingFiles.Count;
                    result.MissingFiles = missingFiles;

                    var msgParts = new List<string>();
                    if (movedCount > 0) msgParts.Add($"{movedCount} moved");
                    if (filesDeleted > 0) msgParts.Add($"{filesDeleted} deleted");
                    if (foldersDeleted > 0) msgParts.Add($"{foldersDeleted} folders removed");
                    if (missingFiles.Count > 0) msgParts.Add($"{missingFiles.Count} missing");

                    result.Message = msgParts.Count > 0
                        ? $"Restore complete: {string.Join(", ", msgParts)}."
                        : "Library already matches snapshot.";

                    progress?.Report(result.Message);
                    return result;
                }
                catch (Exception ex)
                {
                    log.AppendLine($"EXCEPTION: {ex}");
                    WriteLog(log.ToString(), "restore_error");
                    result.Message = $"Restore failed: {ex.Message}";
                    return result;
                }
            });
        }

        #endregion

        #region Utilities

        private static void WriteLog(string content, string prefix)
        {
            try
            {
                string appDataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "DarjeelingMusicOrganizer");
                Directory.CreateDirectory(appDataPath);

                string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                string logPath = Path.Combine(appDataPath, $"{prefix}_{timestamp}.log");
                File.WriteAllText(logPath, content);
            }
            catch { }
        }

        private static string WriteErrorLog(List<string> missingFiles, string backupFolder)
        {
            try
            {
                string appDataPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "DarjeelingMusicOrganizer");
                Directory.CreateDirectory(appDataPath);

                string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
                string logPath = Path.Combine(appDataPath, $"restore_errors_{timestamp}.log");

                var sb = new StringBuilder();
                sb.AppendLine("=== Darjeeling Music Organizer - Restore Error Log ===");
                sb.AppendLine($"Timestamp: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
                sb.AppendLine($"Backup Source: {backupFolder}");
                sb.AppendLine($"Missing Files: {missingFiles.Count}");
                sb.AppendLine();

                foreach (var file in missingFiles)
                {
                    sb.AppendLine($"  - {file}");
                }

                File.WriteAllText(logPath, sb.ToString());
                return logPath;
            }
            catch
            {
                return null;
            }
        }

        private static string FormatBytes(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int counter = 0;
            decimal number = bytes;
            while (Math.Round(number / 1024) >= 1 && counter < suffixes.Length - 1)
            {
                number /= 1024;
                counter++;
            }
            return $"{number:0.#} {suffixes[counter]}";
        }

        #endregion
    }
}
