using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.IO;
using System.Text.Json;

namespace DarjeelingMusicOrganizer
{
    public partial class MainForm : Form
    {
        private Microsoft.Web.WebView2.WinForms.WebView2 webView;
        private Dock dock;

        public MainForm()
        {
            InitializeComponent();
            this.FormBorderStyle = FormBorderStyle.None;
            this.dock = new Dock(this);
            
            // Enable rounded corners (Windows 11)
            var attribute = DWMWINDOWATTRIBUTE.DWMWA_WINDOW_CORNER_PREFERENCE;
            var preference = DWM_WINDOW_CORNER_PREFERENCE.DWMWCP_ROUND;
            try {
                // Cast enum to int explicitly for the ref parameter
                int intPreference = (int)preference;
                DwmSetWindowAttribute(this.Handle, attribute, ref intPreference, sizeof(int));
            } catch {}

            _ = InitializeWebViewAsync();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (dock.IsQuitting)
            {
                base.OnFormClosing(e);
                return;
            }

            if (e.CloseReason == CloseReason.UserClosing)
            {
                try
                {
                    string appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DarjeelingMusicOrganizer");
                    string settingsPath = Path.Combine(appDataPath, "darjeeling_settings.json");

                    if (File.Exists(settingsPath))
                    {
                        var json = File.ReadAllText(settingsPath);
                        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                        var settings = JsonSerializer.Deserialize<AppBridge.SettingsModel>(json, options);
                        
                        if (settings != null && settings.MinimizeToTray)
                        {
                            e.Cancel = true;
                            dock.MinimizeToTray();
                            return;
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"MinimizeToTray error: {ex.Message}");
                }
            }

            base.OnFormClosing(e);
        }

        public enum DWMWINDOWATTRIBUTE
        {
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
        }

        public enum DWM_WINDOW_CORNER_PREFERENCE
        {
            DWMWCP_DEFAULT = 0,
            DWMWCP_DONOTROUND = 1,
            DWMWCP_ROUND = 2,
            DWMWCP_ROUNDSMALL = 3
        }

        [DllImport("dwmapi.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        internal static extern void DwmSetWindowAttribute(IntPtr hwnd, DWMWINDOWATTRIBUTE attribute, ref int pvAttribute, int cbAttribute);

        private async Task InitializeWebViewAsync()
        {
            try 
            {
                this.webView = new Microsoft.Web.WebView2.WinForms.WebView2();
                this.webView.Dock = DockStyle.Fill;
                this.Controls.Add(this.webView);
            
                await this.webView.EnsureCoreWebView2Async(null);
                
                //Disable Status Bar at the bottom left
                this.webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

                //Handle External Links, open them in Default Browser
                this.webView.CoreWebView2.NewWindowRequested += (s, e) => {
                    e.Handled = true;
                    try 
                    {
                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo()
                        {
                            FileName = e.Uri,
                            UseShellExecute = true,
                            Verb = "open"
                        });
                    }
                    catch { }
                };

                this.webView.NavigationCompleted += (s, e) => {
                    if (!e.IsSuccess)
                        MessageBox.Show($"Navigation Failed: {e.WebErrorStatus}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                };

                this.webView.CoreWebView2.AddHostObjectToScript("appBridge", new AppBridge());
                this.webView.Source = new Uri("http://localhost:5173");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"WebView Init Failed: {ex.Message}\n{ex.StackTrace}", "Critical Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

    }
}
