using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DarjeelingMusicOrganizer
{
    public partial class MainForm : Form
    {
        private Microsoft.Web.WebView2.WinForms.WebView2 webView;

        public MainForm()
        {
            InitializeComponent();
            _ = InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            this.webView = new Microsoft.Web.WebView2.WinForms.WebView2();
            this.webView.Dock = DockStyle.Fill;
            this.Controls.Add(this.webView);
            await this.webView.EnsureCoreWebView2Async(null);
            this.webView.Source = new Uri("http://localhost:5173");
        }
    }
}
