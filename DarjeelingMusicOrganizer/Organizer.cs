using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace DarjeelingMusicOrganizer
{
    public class Organizer
    {
        private static readonly JsonSerializerOptions CamelCaseOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };


        public class InboxItem
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public string Type { get; set; } // "file" or "folder"
            public string RelativePath { get; set; }
            public long SizeBytes { get; set; }
            public string Size { get; set; }
            public List<InboxItem> Children { get; set; }
        }

        public class ScanInboxResult
        {
            public string Status { get; set; } // "success", "empty", "not_configured", "error"
            public string Message { get; set; }
            public int TotalFiles { get; set; }
            public List<InboxItem> Items { get; set; }
        }

        public static string ScanInbox(string settingsJson)
        {
            try
            {
                if (string.IsNullOrEmpty(settingsJson))
                {
                    return JsonSerializer.Serialize(new ScanInboxResult
                    {
                        Status = "not_configured",
                        Message = "Collection path is not configured. Please complete settings first.",
                        Items = new List<InboxItem>()
                    }, CamelCaseOptions);
                }

                var settings = JsonSerializer.Deserialize<AppBridge.SettingsModel>(settingsJson);
                string rootPath = settings?.CollectionPath;

                if (string.IsNullOrWhiteSpace(rootPath) || !Directory.Exists(rootPath))
                {
                    return JsonSerializer.Serialize(new ScanInboxResult
                    {
                        Status = "not_configured",
                        Message = "Collection path is invalid or does not exist.",
                        Items = new List<InboxItem>()
                    }, CamelCaseOptions);
                }

                string newFolderPath = Path.Combine(rootPath, "New");
                if (!Directory.Exists(newFolderPath))
                {
                    Directory.CreateDirectory(newFolderPath);
                }

                var items = new List<InboxItem>();
                int totalFiles = 0;

                // Scan recursively
                ScanDirectory(newFolderPath, newFolderPath, items, ref totalFiles);

                if (totalFiles == 0)
                {
                    return JsonSerializer.Serialize(new ScanInboxResult
                    {
                        Status = "empty",
                        Message = "No files to organize. Please place audio files in the 'New' folder.",
                        TotalFiles = 0,
                        Items = new List<InboxItem>()
                    }, CamelCaseOptions);
                }

                return JsonSerializer.Serialize(new ScanInboxResult
                {
                    Status = "success",
                    Message = $"Successfully scanned {totalFiles} files in inbox.",
                    TotalFiles = totalFiles,
                    Items = items
                }, CamelCaseOptions);
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new ScanInboxResult
                {
                    Status = "error",
                    Message = $"Error scanning inbox: {ex.Message}",
                    Items = new List<InboxItem>()
                }, CamelCaseOptions);
            }
        }

        private static void ScanDirectory(string currentDir, string rootDir, List<InboxItem> resultList, ref int totalFiles)
        {
            // Get subdirectories
            var subDirs = Directory.GetDirectories(currentDir);
            foreach (var dir in subDirs)
            {
                var dirInfo = new DirectoryInfo(dir);
                var folderItem = new InboxItem
                {
                    Id = Guid.NewGuid().ToString(),
                    Name = dirInfo.Name,
                    Type = "folder",
                    RelativePath = GetRelativePath(rootDir, dir),
                    Children = new List<InboxItem>()
                };

                int filesInFolderCount = 0;
                ScanDirectory(dir, rootDir, folderItem.Children, ref filesInFolderCount);
                
                if (folderItem.Children.Count > 0)
                {
                    resultList.Add(folderItem);
                    totalFiles += filesInFolderCount;
                }
            }

            // Get supported files in this directory
            var files = Directory.GetFiles(currentDir)
                .Where(f => LibraryManager.SupportedExtensions.Contains(Path.GetExtension(f)))
                .ToList();

            foreach (var file in files)
            {
                var fileInfo = new FileInfo(file);
                resultList.Add(new InboxItem
                {
                    Id = Guid.NewGuid().ToString(),
                    Name = fileInfo.Name,
                    Type = "file",
                    RelativePath = GetRelativePath(rootDir, file),
                    SizeBytes = fileInfo.Length,
                    Size = LibraryManager.FormatBytes(fileInfo.Length)
                });
                totalFiles++;
            }
        }

        private static string GetRelativePath(string rootPath, string fullPath)
        {
            if (!rootPath.EndsWith(Path.DirectorySeparatorChar.ToString()))
            {
                rootPath += Path.DirectorySeparatorChar;
            }
            Uri rootUri = new Uri(rootPath);
            Uri fullUri = new Uri(fullPath);
            Uri relativeUri = rootUri.MakeRelativeUri(fullUri);
            return Uri.UnescapeDataString(relativeUri.ToString()).Replace('/', Path.DirectorySeparatorChar);
        }


    }
}
