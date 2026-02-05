using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using TagLib;

namespace DarjeelingMusicOrganizer
{
    //Manages the Current.sqlite3 db including various methods of scanning, validation, and backup operations etc etc.
    public class LibraryManager
    {
        //Name of the db file
        private const string DatabaseFileName = "Current.sqlite3";
        
        //Big list of supported audio formats
        private static readonly HashSet<string> SupportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mp3", ".flac", ".wav", ".aac", ".m4a", ".ogg", ".opus", ".wma",
            ".aiff", ".aif", ".alac", ".ape", ".dsf", ".dff", ".mpc", ".wv", ".tta"
        };


        public enum ScanResultType
        {
            Success,
            FolderNotNamedLibrary,
            LooseFilesInRoot,
            SongsInArtistFolder,
            UnsupportedFileFormat,
            DatabaseError,
            Cancelled
        }

        public class ScanResult
        {
            public ScanResultType Type { get; set; }
            public string Message { get; set; }
            public string BackupPath { get; set; }
            public LibraryStats Stats { get; set; }
        }

        public class LibraryStats
        {
            public int TotalArtists { get; set; }
            public int TotalAlbums { get; set; }
            public int TotalTracks { get; set; }
            public long TotalSizeBytes { get; set; }
            public string FormattedSize => FormatBytes(TotalSizeBytes);

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
        }

        public class TreeNode
        {
            public int Id { get; set; }
            //Structure: "artist", "album", "file"
            public string Type { get; set; } 
            public string Name { get; set; }
            public string Size { get; set; }
            public bool IsSystemFolder { get; set; }
            public List<TreeNode> Children { get; set; } = new List<TreeNode>();
            
            //Metadata for tracks
            public int? TrackNumber { get; set; }
            public int? DurationMs { get; set; }
            public int? Bitrate { get; set; }
            public string Title { get; set; }
            public string ContributingArtists { get; set; }
        }

        public class BackupManifest
        {
            public DateTime CreatedAt { get; set; }
            public string PreviousDatabaseHash { get; set; }
            public string DatabaseBackupPath { get; set; }
            public List<FolderStructureEntry> FolderStructure { get; set; } = new List<FolderStructureEntry>();
        }

        public class FolderStructureEntry
        {
            public string RelativePath { get; set; }
            //Structure: "artist", "album", "track"
            public string Type { get; set; } 
            public long? SizeBytes { get; set; }
        }




        //Get the full path to the Current.sqlite3 database
        public static string GetDatabasePath(string libraryPath)
        {
            return Path.Combine(libraryPath, DatabaseFileName);
        }

        //Check if the library database exists
        public static bool DatabaseExists(string libraryPath)
        {
            return System.IO.File.Exists(GetDatabasePath(libraryPath));
        }

        //Initializes a new database
        public static void InitializeDatabase(string libraryPath)
        {
            string dbPath = GetDatabasePath(libraryPath);
            
            using (var connection = new SQLiteConnection($"Data Source={dbPath};Version=3;"))
            {
                connection.Open();

                //Artists table
                ExecuteNonQuery(connection, @"
                    CREATE TABLE IF NOT EXISTS Artists (
                        ArtistId INTEGER PRIMARY KEY AUTOINCREMENT,
                        FolderName TEXT NOT NULL COLLATE NOCASE,
                        IsSystemFolder INTEGER DEFAULT 0,
                        CONSTRAINT UQ_Artist_Folder UNIQUE(FolderName)
                    );");

                //Albums table
                ExecuteNonQuery(connection, @"
                    CREATE TABLE IF NOT EXISTS Albums (
                        AlbumId INTEGER PRIMARY KEY AUTOINCREMENT,
                        ArtistId INTEGER NOT NULL,
                        FolderName TEXT NOT NULL COLLATE NOCASE,
                        TitleTag TEXT,
                        Year INTEGER,
                        FOREIGN KEY(ArtistId) REFERENCES Artists(ArtistId) ON DELETE CASCADE,
                        CONSTRAINT UQ_Album_Folder UNIQUE(ArtistId, FolderName)
                    );");

                //Tracks table
                ExecuteNonQuery(connection, @"
                    CREATE TABLE IF NOT EXISTS Tracks (
                        TrackId INTEGER PRIMARY KEY AUTOINCREMENT,
                        AlbumId INTEGER NOT NULL,
                        FileName TEXT NOT NULL,
                        Extension TEXT NOT NULL,
                        SizeBytes INTEGER NOT NULL,
                        DateModified INTEGER NOT NULL,
                        Title TEXT,
                        ContributingArtists TEXT,
                        AlbumArtist TEXT,
                        AlbumTag TEXT,
                        Year INTEGER,
                        TrackNumber INTEGER,
                        DiscNumber INTEGER DEFAULT 1,
                        Genre TEXT,
                        DurationMs INTEGER,
                        Bitrate INTEGER,
                        FOREIGN KEY(AlbumId) REFERENCES Albums(AlbumId) ON DELETE CASCADE,
                        CONSTRAINT UQ_Track_File UNIQUE(AlbumId, FileName)
                    );");

                //Indices
                ExecuteNonQuery(connection, "CREATE INDEX IF NOT EXISTS IDX_Albums_ArtistId ON Albums(ArtistId);");
                ExecuteNonQuery(connection, "CREATE INDEX IF NOT EXISTS IDX_Tracks_AlbumId ON Tracks(AlbumId);");
                ExecuteNonQuery(connection, "CREATE INDEX IF NOT EXISTS IDX_Search_Meta ON Tracks(Title, ContributingArtists, AlbumArtist, Genre);");
                ExecuteNonQuery(connection, "CREATE INDEX IF NOT EXISTS IDX_Sort_Year ON Albums(Year DESC);");

                //Insert Multiple_Artists  folder
                ExecuteNonQuery(connection, @"
                    INSERT OR IGNORE INTO Artists (FolderName, IsSystemFolder) 
                    VALUES ('Multiple_Artists', 1);");
            }
        }

        private static void ExecuteNonQuery(SQLiteConnection connection, string sql)
        {
            using (var cmd = new SQLiteCommand(sql, connection))
            {
                cmd.ExecuteNonQuery();
            }
        }



        //Validates the library folder structure
        public static ScanResult ValidateLibraryFolder(string folderPath)
        {
            //Check if folder is actually named Library
            string folderName = new DirectoryInfo(folderPath).Name;
            if (!folderName.Equals("Library", StringComparison.OrdinalIgnoreCase))
            {
                return new ScanResult
                {
                    Type = ScanResultType.FolderNotNamedLibrary,
                    Message = "Folder must be named 'Library'"
                };
            }

            //Check for loose files in root (exclude the db file)
            var looseFiles = Directory.GetFiles(folderPath)
                .Where(f => !Path.GetFileName(f).Equals(DatabaseFileName, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (looseFiles.Any())
            {
                return new ScanResult
                {
                    Type = ScanResultType.LooseFilesInRoot,
                    Message = "No loose files allowed in the root Library folder"
                };
            }

            //Check for audio files directly in Artist folders
            var artistDirs = Directory.GetDirectories(folderPath);
            foreach (var artistDir in artistDirs)
            {
                var filesInArtist = Directory.GetFiles(artistDir)
                    .Where(f => SupportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                    .ToList();

                if (filesInArtist.Any())
                {
                    string artistName = Path.GetFileName(artistDir);
                    return new ScanResult
                    {
                        Type = ScanResultType.SongsInArtistFolder,
                        Message = $"Invalid structure: Songs found directly in '{artistName}' folder. Structure must be Artist → Album → SongFiles."
                    };
                }
            }

            //Validate all files are supported audio formats
            var allFiles = Directory.GetFiles(folderPath, "*", SearchOption.AllDirectories)
                .Where(f => !Path.GetFileName(f).Equals(DatabaseFileName, StringComparison.OrdinalIgnoreCase));

            foreach (var file in allFiles)
            {
                string ext = Path.GetExtension(file);
                if (!SupportedExtensions.Contains(ext))
                {
                    return new ScanResult
                    {
                        Type = ScanResultType.UnsupportedFileFormat,
                        Message = $"'{Path.GetFileName(file)}' is not a supported audio format"
                    };
                }
            }

            return new ScanResult { Type = ScanResultType.Success };
        }



        //Scans the library folder and populates the database
        public static async Task<ScanResult> ScanAndImportLibrary(string libraryPath, IProgress<string> progress = null)
        {
            return await Task.Run(() =>
            {
                try
                {
                    //Validations
                    var validation = ValidateLibraryFolder(libraryPath);
                    if (validation.Type != ScanResultType.Success)
                    {
                        return validation;
                    }

                    progress?.Report("Preparing database...");

                    //Create backup if database exists (needs to be restructured in the future)
                    string backupPath = null;
                    string dbPath = GetDatabasePath(libraryPath);
                    if (System.IO.File.Exists(dbPath))
                    {
                        backupPath = CreateBackup(libraryPath, progress);
                    }

                    //Delete existing db and create a fresh db
                    if (System.IO.File.Exists(dbPath))
                    {
                        System.IO.File.Delete(dbPath);
                    }

                    InitializeDatabase(libraryPath);

                    progress?.Report("Scanning library structure...");

                    //Scan and populate
                    LibraryStats stats = PopulateDatabase(libraryPath, progress);

                    return new ScanResult
                    {
                        Type = ScanResultType.Success,
                        Message = backupPath != null 
                            ? $"Library updated. Backup created at: {Path.GetFileName(backupPath)}"
                            : "Library imported successfully.",
                        BackupPath = backupPath,
                        Stats = stats
                    };
                }
                catch (Exception ex)
                {
                    return new ScanResult
                    {
                        Type = ScanResultType.DatabaseError,
                        Message = $"Database error: {ex.Message}"
                    };
                }
            });
        }

        private static LibraryStats PopulateDatabase(string libraryPath, IProgress<string> progress)
        {
            string dbPath = GetDatabasePath(libraryPath);
            var stats = new LibraryStats();

            using (var connection = new SQLiteConnection($"Data Source={dbPath};Version=3;"))
            {
                connection.Open();

                //Use transaction for performance
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        //Get all artist folders
                        var artistDirs = Directory.GetDirectories(libraryPath);
                        int totalArtists = artistDirs.Length;
                        int processedArtists = 0;

                        foreach (var artistDir in artistDirs)
                        {
                            string artistName = Path.GetFileName(artistDir);
                            bool isSystem = artistName.Equals("Multiple_Artists", StringComparison.OrdinalIgnoreCase);

                            progress?.Report($"Scanning artist: {artistName} ({++processedArtists}/{totalArtists})");

                            //Insert artists
                            long artistId = InsertArtist(connection, artistName, isSystem);
                            stats.TotalArtists++;

                            //Get album folders
                            var albumDirs = Directory.GetDirectories(artistDir);
                            foreach (var albumDir in albumDirs)
                            {
                                string albumName = Path.GetFileName(albumDir);

                                //Insert albums
                                long albumId = InsertAlbum(connection, artistId, albumName);
                                stats.TotalAlbums++;

                                //Get track files
                                var trackFiles = Directory.GetFiles(albumDir)
                                    .Where(f => SupportedExtensions.Contains(Path.GetExtension(f)))
                                    .OrderBy(f => f)
                                    .ToList();

                                int? albumYear = null;
                                string albumTitleTag = null;

                                foreach (var trackFile in trackFiles)
                                {
                                    var trackInfo = ExtractTrackMetadata(trackFile);
                                    
                                    //GEt metadata from the first track
                                    if (albumYear == null && trackInfo.Year > 0)
                                    {
                                        albumYear = trackInfo.Year;
                                        albumTitleTag = trackInfo.AlbumTag;
                                    }

                                    InsertTrack(connection, albumId, trackInfo);
                                    stats.TotalTracks++;
                                    stats.TotalSizeBytes += trackInfo.SizeBytes;
                                }

                                //Update album with metadata from first track
                                if (albumYear.HasValue || !string.IsNullOrEmpty(albumTitleTag))
                                {
                                    UpdateAlbumMetadata(connection, albumId, albumTitleTag, albumYear);
                                }
                            }
                        }

                        transaction.Commit();
                    }
                    catch
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }

            return stats;
        }

        private static long InsertArtist(SQLiteConnection connection, string folderName, bool isSystem)
        {
            string sql = "INSERT OR IGNORE INTO Artists (FolderName, IsSystemFolder) VALUES (@name, @sys);";
            using (var cmd = new SQLiteCommand(sql, connection))
            {
                cmd.Parameters.AddWithValue("@name", folderName);
                cmd.Parameters.AddWithValue("@sys", isSystem ? 1 : 0);
                cmd.ExecuteNonQuery();
            }

            // Get the ID
            using (var cmd = new SQLiteCommand("SELECT ArtistId FROM Artists WHERE FolderName = @name;", connection))
            {
                cmd.Parameters.AddWithValue("@name", folderName);
                return (long)cmd.ExecuteScalar();
            }
        }

        private static long InsertAlbum(SQLiteConnection connection, long artistId, string folderName)
        {
            string sql = "INSERT OR IGNORE INTO Albums (ArtistId, FolderName) VALUES (@artistId, @name);";
            using (var cmd = new SQLiteCommand(sql, connection))
            {
                cmd.Parameters.AddWithValue("@artistId", artistId);
                cmd.Parameters.AddWithValue("@name", folderName);
                cmd.ExecuteNonQuery();
            }

            using (var cmd = new SQLiteCommand("SELECT AlbumId FROM Albums WHERE ArtistId = @artistId AND FolderName = @name;", connection))
            {
                cmd.Parameters.AddWithValue("@artistId", artistId);
                cmd.Parameters.AddWithValue("@name", folderName);
                return (long)cmd.ExecuteScalar();
            }
        }

        private static void UpdateAlbumMetadata(SQLiteConnection connection, long albumId, string titleTag, int? year)
        {
            string sql = "UPDATE Albums SET TitleTag = @title, Year = @year WHERE AlbumId = @id;";
            using (var cmd = new SQLiteCommand(sql, connection))
            {
                cmd.Parameters.AddWithValue("@title", (object)titleTag ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@year", (object)year ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@id", albumId);
                cmd.ExecuteNonQuery();
            }
        }

        private class TrackMetadata
        {
            public string FileName { get; set; }
            public string Extension { get; set; }
            public long SizeBytes { get; set; }
            public long DateModified { get; set; }
            public string Title { get; set; }
            public string ContributingArtists { get; set; }
            public string AlbumArtist { get; set; }
            public string AlbumTag { get; set; }
            public int? Year { get; set; }
            public int? TrackNumber { get; set; }
            public int? DiscNumber { get; set; }
            public string Genre { get; set; }
            public int? DurationMs { get; set; }
            public int? Bitrate { get; set; }
        }

        private static TrackMetadata ExtractTrackMetadata(string filePath)
        {
            var fileInfo = new FileInfo(filePath);
            var metadata = new TrackMetadata
            {
                FileName = fileInfo.Name,
                Extension = fileInfo.Extension.ToLowerInvariant(),
                SizeBytes = fileInfo.Length,
                DateModified = new DateTimeOffset(fileInfo.LastWriteTimeUtc).ToUnixTimeSeconds()
            };

            try
            {
                using (var tfile = TagLib.File.Create(filePath))
                {
                    metadata.Title = tfile.Tag.Title;
                    metadata.ContributingArtists = tfile.Tag.Performers != null 
                        ? string.Join("; ", tfile.Tag.Performers) 
                        : null;
                    metadata.AlbumArtist = tfile.Tag.FirstAlbumArtist;
                    metadata.AlbumTag = tfile.Tag.Album;
                    metadata.Year = tfile.Tag.Year > 0 ? (int?)tfile.Tag.Year : null;
                    metadata.TrackNumber = tfile.Tag.Track > 0 ? (int?)tfile.Tag.Track : null;
                    metadata.DiscNumber = tfile.Tag.Disc > 0 ? (int?)tfile.Tag.Disc : 1;
                    metadata.Genre = tfile.Tag.FirstGenre;
                    metadata.DurationMs = (int?)tfile.Properties?.Duration.TotalMilliseconds;
                    metadata.Bitrate = tfile.Properties?.AudioBitrate;
                }
            }
            catch
            {
                //If metadata extraction fails, will just use file info
            }

            return metadata;
        }

        private static void InsertTrack(SQLiteConnection connection, long albumId, TrackMetadata track)
        {
            string sql = @"
                INSERT OR REPLACE INTO Tracks 
                (AlbumId, FileName, Extension, SizeBytes, DateModified, Title, ContributingArtists, 
                 AlbumArtist, AlbumTag, Year, TrackNumber, DiscNumber, Genre, DurationMs, Bitrate)
                VALUES 
                (@albumId, @fileName, @ext, @size, @modified, @title, @artists, 
                 @albumArtist, @albumTag, @year, @trackNum, @discNum, @genre, @duration, @bitrate);";

            using (var cmd = new SQLiteCommand(sql, connection))
            {
                cmd.Parameters.AddWithValue("@albumId", albumId);
                cmd.Parameters.AddWithValue("@fileName", track.FileName);
                cmd.Parameters.AddWithValue("@ext", track.Extension);
                cmd.Parameters.AddWithValue("@size", track.SizeBytes);
                cmd.Parameters.AddWithValue("@modified", track.DateModified);
                cmd.Parameters.AddWithValue("@title", (object)track.Title ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@artists", (object)track.ContributingArtists ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@albumArtist", (object)track.AlbumArtist ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@albumTag", (object)track.AlbumTag ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@year", (object)track.Year ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@trackNum", (object)track.TrackNumber ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@discNum", (object)track.DiscNumber ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@genre", (object)track.Genre ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@duration", (object)track.DurationMs ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@bitrate", (object)track.Bitrate ?? DBNull.Value);
                cmd.ExecuteNonQuery();
            }
        }



        //Loading library tree via db
        public static List<TreeNode> GetLibraryTree(string libraryPath)
        {
            var tree = new List<TreeNode>();
            string dbPath = GetDatabasePath(libraryPath);

            if (!System.IO.File.Exists(dbPath))
            {
                return tree;
            }

            using (var connection = new SQLiteConnection($"Data Source={dbPath};Version=3;"))
            {
                connection.Open();

                var artists = new List<(long id, string name, bool isSystem)>();
                using (var cmd = new SQLiteCommand("SELECT ArtistId, FolderName, IsSystemFolder FROM Artists ORDER BY IsSystemFolder, FolderName;", connection))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        artists.Add((reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2) == 1));
                    }
                }

                foreach (var artist in artists)
                {
                    var artistNode = new TreeNode
                    {
                        Id = (int)artist.id,
                        Type = "artist",
                        Name = artist.name,
                        IsSystemFolder = artist.isSystem,
                        Children = new List<TreeNode>()
                    };

                    var albums = new List<(long id, string name, string titleTag, int? year)>();
                    using (var cmd = new SQLiteCommand("SELECT AlbumId, FolderName, TitleTag, Year FROM Albums WHERE ArtistId = @artistId ORDER BY Year DESC, FolderName;", connection))
                    {
                        cmd.Parameters.AddWithValue("@artistId", artist.id);
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                albums.Add((
                                    reader.GetInt64(0),
                                    reader.GetString(1),
                                    reader.IsDBNull(2) ? null : reader.GetString(2),
                                    reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3)
                                ));
                            }
                        }
                    }

                    foreach (var album in albums)
                    {
                        var albumNode = new TreeNode
                        {
                            Id = (int)album.id,
                            Type = "album",
                            Name = album.name,
                            Children = new List<TreeNode>()
                        };

                        using (var cmd = new SQLiteCommand(@"
                            SELECT TrackId, FileName, SizeBytes, TrackNumber, DurationMs, Bitrate, Title, ContributingArtists 
                            FROM Tracks WHERE AlbumId = @albumId 
                            ORDER BY DiscNumber, TrackNumber, FileName;", connection))
                        {
                            cmd.Parameters.AddWithValue("@albumId", album.id);
                            using (var reader = cmd.ExecuteReader())
                            {
                                while (reader.Read())
                                {
                                    long sizeBytes = reader.GetInt64(2);
                                    albumNode.Children.Add(new TreeNode
                                    {
                                        Id = reader.GetInt32(0),
                                        Type = "file",
                                        Name = reader.GetString(1),
                                        Size = FormatBytes(sizeBytes),
                                        TrackNumber = reader.IsDBNull(3) ? (int?)null : reader.GetInt32(3),
                                        DurationMs = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4),
                                        Bitrate = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                                        Title = reader.IsDBNull(6) ? null : reader.GetString(6),
                                        ContributingArtists = reader.IsDBNull(7) ? null : reader.GetString(7)
                                    });
                                }
                            }
                        }

                        artistNode.Children.Add(albumNode);
                    }

                    tree.Add(artistNode);
                }
            }

            return tree;
        }

        //Load library statistics from db
        public static LibraryStats GetLibraryStats(string libraryPath)
        {
            var stats = new LibraryStats();
            string dbPath = GetDatabasePath(libraryPath);

            if (!System.IO.File.Exists(dbPath))
            {
                return stats;
            }

            using (var connection = new SQLiteConnection($"Data Source={dbPath};Version=3;"))
            {
                connection.Open();

                using (var cmd = new SQLiteCommand("SELECT COUNT(*) FROM Artists;", connection))
                {
                    stats.TotalArtists = Convert.ToInt32(cmd.ExecuteScalar());
                }

                using (var cmd = new SQLiteCommand("SELECT COUNT(*) FROM Albums;", connection))
                {
                    stats.TotalAlbums = Convert.ToInt32(cmd.ExecuteScalar());
                }

                using (var cmd = new SQLiteCommand("SELECT COUNT(*), COALESCE(SUM(SizeBytes), 0) FROM Tracks;", connection))
                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        stats.TotalTracks = reader.GetInt32(0);
                        stats.TotalSizeBytes = reader.GetInt64(1);
                    }
                }
            }

            return stats;
        }

        //Search library
        public static List<TreeNode> SearchLibrary(string libraryPath, string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return GetLibraryTree(libraryPath);
            }

            var results = new List<TreeNode>();
            string dbPath = GetDatabasePath(libraryPath);

            if (!System.IO.File.Exists(dbPath))
            {
                return results;
            }

            string searchPattern = $"%{query}%";

            using (var connection = new SQLiteConnection($"Data Source={dbPath};Version=3;"))
            {
                connection.Open();

                string sql = @"
                    SELECT DISTINCT a.ArtistId, a.FolderName, a.IsSystemFolder,
                           al.AlbumId, al.FolderName,
                           t.TrackId, t.FileName, t.SizeBytes, t.TrackNumber, t.DurationMs, t.Bitrate, t.Title, t.ContributingArtists
                    FROM Artists a
                    JOIN Albums al ON a.ArtistId = al.ArtistId
                    JOIN Tracks t ON al.AlbumId = t.AlbumId
                    WHERE a.FolderName LIKE @query 
                       OR al.FolderName LIKE @query 
                       OR t.FileName LIKE @query 
                       OR t.Title LIKE @query 
                       OR t.ContributingArtists LIKE @query
                    ORDER BY a.IsSystemFolder, a.FolderName, al.Year DESC, al.FolderName, t.DiscNumber, t.TrackNumber;";

                var artistDict = new Dictionary<long, TreeNode>();
                var albumDict = new Dictionary<long, TreeNode>();

                using (var cmd = new SQLiteCommand(sql, connection))
                {
                    cmd.Parameters.AddWithValue("@query", searchPattern);
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            long artistId = reader.GetInt64(0);
                            long albumId = reader.GetInt64(3);


                            if (!artistDict.TryGetValue(artistId, out TreeNode artistNode))
                            {
                                artistNode = new TreeNode
                                {
                                    Id = (int)artistId,
                                    Type = "artist",
                                    Name = reader.GetString(1),
                                    IsSystemFolder = reader.GetInt32(2) == 1,
                                    Children = new List<TreeNode>()
                                };
                                artistDict[artistId] = artistNode;
                                results.Add(artistNode);
                            }

                            if (!albumDict.TryGetValue(albumId, out TreeNode albumNode))
                            {
                                albumNode = new TreeNode
                                {
                                    Id = (int)albumId,
                                    Type = "album",
                                    Name = reader.GetString(4),
                                    Children = new List<TreeNode>()
                                };
                                albumDict[albumId] = albumNode;
                                artistNode.Children.Add(albumNode);
                            }

                            //Add  Track
                            long sizeBytes = reader.GetInt64(7);
                            albumNode.Children.Add(new TreeNode
                            {
                                Id = reader.GetInt32(5),
                                Type = "file",
                                Name = reader.GetString(6),
                                Size = FormatBytes(sizeBytes),
                                TrackNumber = reader.IsDBNull(8) ? (int?)null : reader.GetInt32(8),
                                DurationMs = reader.IsDBNull(9) ? (int?)null : reader.GetInt32(9),
                                Bitrate = reader.IsDBNull(10) ? (int?)null : reader.GetInt32(10),
                                Title = reader.IsDBNull(11) ? null : reader.GetString(11),
                                ContributingArtists = reader.IsDBNull(12) ? null : reader.GetString(12)
                            });
                        }
                    }
                }
            }

            return results;
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



        //Backup system, needs to be remodeled later, does not work well rn
        public static string CreateBackup(string libraryPath, IProgress<string> progress = null)
        {
            progress?.Report("Creating backup...");

            string collectionPath = Directory.GetParent(libraryPath)?.FullName;
            if (collectionPath == null) return null;

            string backupsPath = Path.Combine(collectionPath, "Backups");
            Directory.CreateDirectory(backupsPath);

            string timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
            string backupFolder = Path.Combine(backupsPath, $"backup_{timestamp}");
            Directory.CreateDirectory(backupFolder);



            string dbPath = GetDatabasePath(libraryPath);
            string dbBackupPath = null;
            if (System.IO.File.Exists(dbPath))
            {
                dbBackupPath = Path.Combine(backupFolder, DatabaseFileName);
                System.IO.File.Copy(dbPath, dbBackupPath);
            }

        


            var manifest = new BackupManifest
            {
                CreatedAt = DateTime.UtcNow,
                DatabaseBackupPath = dbBackupPath != null ? DatabaseFileName : null,
                FolderStructure = new List<FolderStructureEntry>()
            };



            foreach (var artistDir in Directory.GetDirectories(libraryPath))
            {
                string artistName = Path.GetFileName(artistDir);
                manifest.FolderStructure.Add(new FolderStructureEntry
                {
                    RelativePath = artistName,
                    Type = "artist"
                });

                foreach (var albumDir in Directory.GetDirectories(artistDir))
                {
                    string albumRelPath = Path.Combine(artistName, Path.GetFileName(albumDir));
                    manifest.FolderStructure.Add(new FolderStructureEntry
                    {
                        RelativePath = albumRelPath,
                        Type = "album"
                    });

                    foreach (var trackFile in Directory.GetFiles(albumDir))
                    {
                        var fi = new FileInfo(trackFile);
                        manifest.FolderStructure.Add(new FolderStructureEntry
                        {
                            RelativePath = Path.Combine(albumRelPath, fi.Name),
                            Type = "track",
                            SizeBytes = fi.Length
                        });
                    }
                }
            }


            string manifestPath = Path.Combine(backupFolder, "manifest.json");
            System.IO.File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }));

            return backupFolder;
        }

        public static bool RestoreFromBackup(string backupFolder, string libraryPath)
        {
            try
            {
                string manifestPath = Path.Combine(backupFolder, "manifest.json");
                if (!System.IO.File.Exists(manifestPath))
                {
                    return false;
                }

                var manifest = JsonSerializer.Deserialize<BackupManifest>(System.IO.File.ReadAllText(manifestPath));


                if (!string.IsNullOrEmpty(manifest.DatabaseBackupPath))
                {
                    string sourceDb = Path.Combine(backupFolder, manifest.DatabaseBackupPath);
                    string destDb = GetDatabasePath(libraryPath);
                    
                    if (System.IO.File.Exists(sourceDb))
                    {
                        if (System.IO.File.Exists(destDb))
                        {
                            System.IO.File.Delete(destDb);
                        }
                        System.IO.File.Copy(sourceDb, destDb);
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }


    }
}
