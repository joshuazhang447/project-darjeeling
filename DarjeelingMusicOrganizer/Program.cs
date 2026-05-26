using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace DarjeelingMusicOrganizer
{
    internal static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main()
        {
            //Global exception handlers to prevent silent crashes
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += Application_ThreadException;
            AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        //Catches unhandled exceptions on the UI thread
        private static void Application_ThreadException(object sender, ThreadExceptionEventArgs e)
        {
            LogAndShowError(e.Exception);
        }

        //Catches unhandled exceptions on background/async threads
        private static void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            LogAndShowError(e.ExceptionObject as Exception);
        }

        private static void LogAndShowError(Exception ex)
        {
            string message = ex != null
                ? $"{ex.GetType().Name}: {ex.Message}\n\nStack Trace:\n{ex.StackTrace}"
                : "Unknown error occurred.";

            //Write to crash log in AppData
            try
            {
                string logDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "DarjeelingMusicOrganizer");
                Directory.CreateDirectory(logDir);

                string logPath = Path.Combine(logDir, "crash.log");
                string entry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}]\n{message}\n{"".PadRight(60, '-')}\n";
                File.AppendAllText(logPath, entry);
            }
            catch { }

            MessageBox.Show(
                $"An unexpected error occurred:\n\n{message}",
                "Darjeeling - Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
