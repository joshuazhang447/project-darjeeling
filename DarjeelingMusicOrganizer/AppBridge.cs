using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using System.Text.Json;

namespace DarjeelingMusicOrganizer
{
    [ClassInterface(ClassInterfaceType.None)]
    [ComVisible(true)]
    public class AppBridge
    {
        private const string SettingsFileName = "darjeeling_settings.json";
        private static readonly System.Net.Http.HttpClient httpClient = new System.Net.Http.HttpClient();




        public void MinimizeWindow()
        {
            if (Form.ActiveForm != null)
            {
                Form.ActiveForm.WindowState = FormWindowState.Minimized;
            }
        }

        public void CloseWindow()
        {
            Application.Exit();
        }

        public void DragWindow()
        {
            if (Form.ActiveForm != null)
            {
                ReleaseCapture();
                //WM_NCLBUTTONDOWN, HT_CAPTION
                SendMessage(Form.ActiveForm.Handle, 0xA1, 0x2, 0); 
            }
        }

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        public string GetSettings()
        {
            try
            {
                //C:\Users\<username>\AppData\Roaming\DarjeelingMusicOrganizer\darjeeling_settings.json
                string appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DarjeelingMusicOrganizer");
                string settingsPath = Path.Combine(appDataPath, SettingsFileName);

                if (File.Exists(settingsPath))
                {
                    string json = File.ReadAllText(settingsPath);
                    try 
                    {
                        var settings = JsonSerializer.Deserialize<SettingsModel>(json);
                        
                        //Decrypt API Key for the UI
                        if (!string.IsNullOrEmpty(settings.ApiKey))
                        {
                            settings.ApiKey = DecryptString(settings.ApiKey);
                        }

                        //Validate the Collection Path
                        if (!string.IsNullOrWhiteSpace(settings.CollectionPath) && Directory.Exists(settings.CollectionPath))
                        {
                            return JsonSerializer.Serialize(settings);
                        }
                        
                        return JsonSerializer.Serialize(settings);
                    }
                    catch 
                    {
                        //This means the setting file is corrupted, ignore it
                    }
                }
            }
            catch { }
            return null;
        }

        public async System.Threading.Tasks.Task<string> TestConnection(string settingsJson)
        {
            try
            {
                var settings = JsonSerializer.Deserialize<SettingsModel>(settingsJson);
                if (settings == null || string.IsNullOrWhiteSpace(settings.ApiKey))
                {
                    return JsonSerializer.Serialize(new { success = false, message = "API Key is missing." });
                }

                string apiKey = settings.ApiKey;
                string apiEndpoint = !string.IsNullOrWhiteSpace(settings.ApiEndpoint) 
                    ? settings.ApiEndpoint.TrimEnd('/') 
                    : "https://generativelanguage.googleapis.com/v1beta";

                string modelVersion = !string.IsNullOrWhiteSpace(settings.ModelVersion)
                    ? settings.ModelVersion
                    : "gemini-3-flash-preview";

                //Determine Provider
                bool isOpenAI = string.Equals(settings.AiProvider, "OpenAI", StringComparison.OrdinalIgnoreCase);

                string requestUrl;
                System.Net.Http.HttpRequestMessage request;
                string jsonBody;

                if (isOpenAI)
                {
                    //Unused (no API key to test)
                    //Works as:
                    //Try to generate 1 token
                    //Endpoint provided ends with /v1/chat/completions
                    //If the user provided the full chat/completions path, use it. 
                    //If they provided base, append it.
                    
                    if (apiEndpoint.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
                    {
                        requestUrl = apiEndpoint;
                    }
                    else 
                    {
                        requestUrl = $"{apiEndpoint}/chat/completions";
                    }

                    request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, requestUrl);
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
                    
                    var payload = new 
                    {
                        model = modelVersion,
                        messages = new[] { new { role = "user", content = "Hi" } },
                        max_tokens = 1
                    };
                    jsonBody = JsonSerializer.Serialize(payload);
                }
                else
                {
                    //Google Validation: Try to generate content
                    //Endpoint: https://generativelanguage.googleapis.com/v1beta
                    //Target: .../models/{model}:generateContent?key={key}

                    //Ensure it's targeting the models endpoint correctly
                    if (apiEndpoint.EndsWith("/models", StringComparison.OrdinalIgnoreCase))
                    {
                        //Strip /models if the user pasted it
                        apiEndpoint = apiEndpoint.Substring(0, apiEndpoint.LastIndexOf("/models", StringComparison.OrdinalIgnoreCase));
                    }

                    requestUrl = $"{apiEndpoint}/models/{modelVersion}:generateContent?key={apiKey}";
                    request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, requestUrl);
                    
                    var payload = new 
                    {
                        contents = new[] 
                        { 
                            new { parts = new[] { new { text = "Hi" } } } 
                        }
                    };
                    jsonBody = JsonSerializer.Serialize(payload);
                }

                request.Content = new System.Net.Http.StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");

                using (request)
                {
                    var response = await httpClient.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        return JsonSerializer.Serialize(new { success = true, message = "Connected" });
                    }
                    else
                    {
                        string errorContent = await response.Content.ReadAsStringAsync();
                        return JsonSerializer.Serialize(new { success = false, message = $"HTTP {response.StatusCode}: {errorContent}" });
                    }
                }
            }
            catch (Exception ex)
            {
                return JsonSerializer.Serialize(new { success = false, message = ex.Message });
            }
        }

        public void SaveSettings(string settingsJson)
        {
            try
            {
                var newSettings = JsonSerializer.Deserialize<SettingsModel>(settingsJson);
                if (newSettings == null) return;

                string appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DarjeelingMusicOrganizer");
                if (!Directory.Exists(appDataPath)) Directory.CreateDirectory(appDataPath);
                
                string settingsPath = Path.Combine(appDataPath, SettingsFileName);
                
                SettingsModel currentSettings = new SettingsModel();
                if (File.Exists(settingsPath))
                {
                    try
                    {
                        currentSettings = JsonSerializer.Deserialize<SettingsModel>(File.ReadAllText(settingsPath)) ?? new SettingsModel();
                    }
                    catch { }
                }

                //Update fields
                if (newSettings.AiProvider != null) currentSettings.AiProvider = newSettings.AiProvider;
                if (newSettings.ApiEndpoint != null) currentSettings.ApiEndpoint = newSettings.ApiEndpoint;
                if (newSettings.ModelVersion != null) currentSettings.ModelVersion = newSettings.ModelVersion;
                if (newSettings.CollectionPath != null) currentSettings.CollectionPath = newSettings.CollectionPath; // In case UI sends it

                //API Key Encryption
                if (!string.IsNullOrEmpty(newSettings.ApiKey))
                {
                    currentSettings.ApiKey = EncryptString(newSettings.ApiKey);
                }

                if (newSettings.InitializedAt != null) currentSettings.InitializedAt = newSettings.InitializedAt;

                File.WriteAllText(settingsPath, JsonSerializer.Serialize(currentSettings, new JsonSerializerOptions { WriteIndented = true }));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Error saving settings: " + ex.Message);
            }
        }
        
        //Encryption Methods
        private string EncryptString(string plainText)
        {
            try
            {
                if (string.IsNullOrEmpty(plainText)) return plainText;
                byte[] plainBytes = System.Text.Encoding.UTF8.GetBytes(plainText);
                byte[] cipherBytes = System.Security.Cryptography.ProtectedData.Protect(plainBytes, null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
                return Convert.ToBase64String(cipherBytes);
            }
            catch { return null; }
        }

        private string DecryptString(string cipherText)
        {
            try
            {
                if (string.IsNullOrEmpty(cipherText)) return cipherText;
                byte[] cipherBytes = Convert.FromBase64String(cipherText);
                byte[] plainBytes = System.Security.Cryptography.ProtectedData.Unprotect(cipherBytes, null, System.Security.Cryptography.DataProtectionScope.CurrentUser);
                return System.Text.Encoding.UTF8.GetString(plainBytes);
            }
            //Should return empty if decryption fails
            catch { return ""; } 
        }

        private class SettingsModel
        {
            public string CollectionPath { get; set; }
            public DateTime? InitializedAt { get; set; }
            public string AiProvider { get; set; }
            public string ApiKey { get; set; }
            public string ApiEndpoint { get; set; }
            public string ModelVersion { get; set; }
        }

        public string SelectFolder()
        {
            //Native Windows folder picker IFileOpenDialog (not the web one)
            var dialog = (IFileOpenDialog)new FileOpenDialog();
            try
            {
                dialog.SetOptions(FOS.FOS_PICKFOLDERS | FOS.FOS_FORCEFILESYSTEM);
                if (dialog.Show(IntPtr.Zero) == 0)
                {
                    IShellItem item;
                    dialog.GetResult(out item);
                    string path;
                    item.GetDisplayName(SIGDN.SIGDN_FILESYSPATH, out path);
                    return path;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(ex.Message);
            }
            return null;
        }

        private string GetEffectivePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return path;
            
            try 
            {
                //If the selected folder is named "Collection or collection", use it directly.
                var dirInfo = new DirectoryInfo(path);
                if (dirInfo.Name.Equals("Collection", StringComparison.OrdinalIgnoreCase))
                {
                    return path;
                }
                
                //Otherwise, target a "Collection" subfolder.
                return Path.Combine(path, "Collection");
            }
            catch 
            {
                //Fallback for root drives or weird paths
                return Path.Combine(path, "Collection");
            }
        }

        public string CheckFolderStructure(string rootPath)
        {
            if (string.IsNullOrWhiteSpace(rootPath))
                return "{}";

            string effectivePath = GetEffectivePath(rootPath);
            bool rootExists = Directory.Exists(effectivePath);

            //If the root Collection folder doesn't exist, the subfolders don't exist either.
            var result = new
            {
                New = rootExists && Directory.Exists(Path.Combine(effectivePath, "New")),
                Library = rootExists && Directory.Exists(Path.Combine(effectivePath, "Library")),
                Backups = rootExists && Directory.Exists(Path.Combine(effectivePath, "Backups")),
                EffectivePath = effectivePath
            };

            return JsonSerializer.Serialize(result);
        }

        public void InitializeCollection(string rootPath)
        {
            if (string.IsNullOrWhiteSpace(rootPath)) return;

            string effectivePath = GetEffectivePath(rootPath);
            
            Directory.CreateDirectory(effectivePath);
            Directory.CreateDirectory(Path.Combine(effectivePath, "New"));
            Directory.CreateDirectory(Path.Combine(effectivePath, "Library"));
            Directory.CreateDirectory(Path.Combine(effectivePath, "Backups"));

            string appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DarjeelingMusicOrganizer");
            Directory.CreateDirectory(appDataPath);
            string settingsPath = Path.Combine(appDataPath, SettingsFileName);

            var settings = new SettingsModel
            {
                CollectionPath = effectivePath,
                InitializedAt = DateTime.UtcNow
            };

            File.WriteAllText(settingsPath, JsonSerializer.Serialize(settings));
        }

        //Stupid ass workaround to get the native Windows folder picker IFileOpenDialog
        [ComImport]
        [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
        [ClassInterface(ClassInterfaceType.None)]
        private class FileOpenDialog { }

        [ComImport]
        [Guid("d57c7288-d4ad-4768-be02-9d969532d960")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFileOpenDialog
        {
            [PreserveSig] int Show([In] IntPtr parent);
            void SetFileTypes(uint cFileTypes, [In, MarshalAs(UnmanagedType.LPArray)] IntPtr rgFilterSpec);
            void SetFileTypeIndex(uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise([In, MarshalAs(UnmanagedType.Interface)] IntPtr pfde, out uint pdwCookie);
            void Unadvise(uint dwCookie);
            void SetOptions([In] FOS fos);
            void GetOptions(out FOS pfos);
            void SetDefaultFolder([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi);
            void SetFolder([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi);
            void GetFolder([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void GetCurrentSelection([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
            void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
            void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
            void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
            void GetResult([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void AddPlace([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, int fdap);
            void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
            void Close([MarshalAs(UnmanagedType.Error)] int hr);
            void SetClientGuid([In] ref Guid guid);
            void ClearClientData();
            void SetFilter([MarshalAs(UnmanagedType.Interface)] IntPtr pFilter);

            //IFileOpenDialog
            void GetResults([MarshalAs(UnmanagedType.Interface)] out IntPtr ppenum);
            void GetSelectedItems([MarshalAs(UnmanagedType.Interface)] out IntPtr ppsai);
        }

        [ComImport]
        [Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItem
        {
            void BindToHandler([In, MarshalAs(UnmanagedType.Interface)] IntPtr pbc, [In] ref Guid bhid, [In] ref Guid riid, out IntPtr ppv);
            void GetParent([MarshalAs(UnmanagedType.Interface)] out IShellItem ppsi);
            void GetDisplayName([In] SIGDN sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
            void GetAttributes([In] uint sfgaoMask, out uint psfgaoAttribs);
            void Compare([In, MarshalAs(UnmanagedType.Interface)] IShellItem psi, [In] uint hint, out int piOrder);
        }

        [Flags]
        private enum FOS : uint
        {
            FOS_PICKFOLDERS = 0x00000020,
            FOS_FORCEFILESYSTEM = 0x00000040
        }

        private enum SIGDN : uint
        {
            SIGDN_FILESYSPATH = 0x80058000
        }
    }
}
