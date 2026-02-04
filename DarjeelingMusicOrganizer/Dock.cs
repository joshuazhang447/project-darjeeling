using System;
using System.Windows.Forms;
using System.Drawing;

namespace DarjeelingMusicOrganizer
{
    public class Dock : IDisposable
    {
        private NotifyIcon notifyIcon;
        private Form mainForm;
        private ContextMenuStrip contextMenu;
        public bool IsQuitting { get; private set; } = false;

        public Dock(Form form)
        {
            this.mainForm = form;
            Initialize();
        }

        private void Initialize()
        {
            contextMenu = new ContextMenuStrip();
            
            //Style the menu a bit (standard windows)
            var quitItem = new ToolStripMenuItem("Quit");
            quitItem.Click += QuitItem_Click;
            
            contextMenu.Items.Add(quitItem);

            notifyIcon = new NotifyIcon();
            notifyIcon.Icon = mainForm.Icon ?? SystemIcons.Application; 
            notifyIcon.Text = "Darjeeling Music Organizer";
            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = false; 

            notifyIcon.MouseClick += NotifyIcon_MouseClick;
            notifyIcon.DoubleClick += (s, e) => RestoreWindow();
        }

        private void NotifyIcon_MouseClick(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                RestoreWindow();
            }
        }

        private void QuitItem_Click(object sender, EventArgs e)
        {
            IsQuitting = true;
            mainForm.Close();
        }

        public void RestoreWindow()
        {
            mainForm.Show();
            mainForm.WindowState = FormWindowState.Normal;
            mainForm.Activate();
            notifyIcon.Visible = false;
        }

        public void MinimizeToTray()
        {
            notifyIcon.Visible = true;
            mainForm.Hide();
        }

        public void Dispose()
        {
            notifyIcon?.Dispose();
            contextMenu?.Dispose();
        }
    }
}
