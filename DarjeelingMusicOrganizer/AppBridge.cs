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
                        //quick parse the file here
                        using (JsonDocument doc = JsonDocument.Parse(json))
                        {
                            if (doc.RootElement.TryGetProperty("CollectionPath", out JsonElement pathElement))
                            {
                                string path = pathElement.GetString();
                                if (!string.IsNullOrWhiteSpace(path) && Directory.Exists(path))
                                {
                                    return json;
                                }
                            }
                        }
                        //The path doesn't exist or invalid. 
                        //It is treated as not configured. 
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

            var settings = new
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
