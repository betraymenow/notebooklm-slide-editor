// 슬라이드 편집기 실행 프로그램 (install.bat 이 SlideEditor.exe 로 빌드한다)
// cmd 창 없이 서버를 띄우고, 편집기를 주소창·탭이 없는 전용 창(크롬 앱 모드)으로 연다. 창을 모두 닫으면 서버도 끝난다
//  - 인수 없이 실행: 편집기를 열거나, 이미 떠 있으면 그 창을 앞으로 가져온다
//  - 파일 경로를 주면(탐색기 "연결 프로그램"): 그 파일을 편집기에서 바로 연다
//    편집기가 이미 떠 있으면 새 창을 열지 않고 그 창에서 열고, 창을 앞으로 가져온다
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("슬라이드 편집기")]
[assembly: AssemblyProduct("슬라이드 편집기")]
[assembly: AssemblyDescription("NotebookLM 슬라이드 편집기")]

static class Program
{
    const string Title = "슬라이드 편집기";
    const string PageTitle = "NotebookLM Slide Editor";  // index.html 의 <title>. 크롬 창 제목이 이걸로 시작한다
    const int FirstPort = 3000, LastPort = 3010;   // Vite 는 3000 이 차 있으면 다음 번호를 쓴다
    const int StartTimeoutSec = 60;
    const string LogFile = @"launcher\server.log";  // 창이 없으니 서버 출력은 여기에 남긴다
    static readonly string[] Extensions = { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".pdf" };

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            string token = args.Length > 0 ? StageFile(root, args[0]) : null;
            string query = token != null ? "?open=" + token : "";
            int port = FindServer();
            if (port != 0 && token != null && OpenInExistingTab(port, token)) return 0;
            if (port != 0 && token == null)
            {
                IntPtr window = FindEditorWindow();
                if (window != IntPtr.Zero) { BringToFront(window); return 0; }
            }
            if (port == 0)
            {
                StartServer(root);
                port = WaitForServer();
                if (port == 0) throw new Exception("편집기 서버가 " + StartTimeoutSec + "초 안에 시작되지 않았습니다.\n" + LogFile + " 또는 run.bat 으로 오류 메시지를 확인해 주세요.");
            }
            OpenBrowser("http://localhost:" + port + "/" + query);
            return 0;
        }
        catch (Exception e)
        {
            MessageBox.Show(e.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    // 편집기가 받아 갈 수 있게 .inbox 에 임의 이름으로 복사한다 (받아 가면 서버가 지운다)
    static string StageFile(string root, string source)
    {
        if (!File.Exists(source)) throw new Exception("파일을 찾을 수 없습니다.\n" + source);
        string ext = Path.GetExtension(source).ToLowerInvariant();
        if (Array.IndexOf(Extensions, ext) < 0) throw new Exception("이미지 또는 PDF 파일만 열 수 있습니다.\n" + source);

        string inbox = Path.Combine(root, ".inbox");
        Directory.CreateDirectory(inbox);
        foreach (string old in Directory.GetFiles(inbox))  // 받아 가지 않은 채 남은 파일 정리
        {
            try { if (File.GetLastWriteTime(old) < DateTime.Now.AddHours(-1)) File.Delete(old); } catch { }
        }
        string token = Guid.NewGuid().ToString("N");
        File.Copy(source, Path.Combine(inbox, token + ext));
        return token;
    }

    // 편집기 탭이 보이는 크롬 창이 있으면 그 탭으로 파일을 보내고 창을 앞으로 가져온다.
    // 탭이 다른 탭 뒤에 숨어 있으면 바깥에서 그 탭으로 바꿀 방법이 없어서, 이때는 새 탭으로 연다
    static bool OpenInExistingTab(int port, string token)
    {
        IntPtr window = FindEditorWindow();
        if (window == IntPtr.Zero) return false;
        try
        {
            var req = (HttpWebRequest)WebRequest.Create("http://localhost:" + port + "/__slide-editor/deliver/" + token);
            req.Timeout = 2000;
            req.Proxy = null;
            using (var res = req.GetResponse())
            using (var reader = new StreamReader(res.GetResponseStream()))
            {
                if (reader.ReadToEnd() != "delivered") return false;
            }
        }
        catch { return false; }
        BringToFront(window);
        return true;
    }

    // 다른 프로그램이 앞에 있으면 Windows 가 창 전환을 막기도 해서, 잠시 그 프로그램의 입력에 붙어서 전환한다
    static void BringToFront(IntPtr window)
    {
        if (IsIconic(window)) ShowWindow(window, SW_RESTORE);
        uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
        uint myThread = GetCurrentThreadId();
        bool attached = fgThread != myThread && AttachThreadInput(myThread, fgThread, true);
        SetForegroundWindow(window);
        BringWindowToTop(window);
        if (attached) AttachThreadInput(myThread, fgThread, false);
        if (GetForegroundWindow() == window) return;
        // 그래도 막히면 Alt 키를 한 번 눌렀다 떼면 전환이 허용된다
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        SetForegroundWindow(window);
    }

    static IntPtr FindEditorWindow()
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd)) return true;
            var cls = new StringBuilder(64);
            GetClassName(hWnd, cls, cls.Capacity);
            if (cls.ToString() != "Chrome_WidgetWin_1") return true;
            var text = new StringBuilder(256);
            GetWindowText(hWnd, text, text.Capacity);
            if (!text.ToString().StartsWith(PageTitle)) return true;
            found = hWnd;
            return false;  // 위에 있는 창부터 나오므로 처음 찾은 창을 쓴다
        }, IntPtr.Zero);
        return found;
    }

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    const int SW_RESTORE = 9;
    const byte VK_MENU = 0x12;
    const uint KEYEVENTF_KEYUP = 0x2;
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);

    static int FindServer()
    {
        for (int port = FirstPort; port <= LastPort; port++)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://localhost:" + port + "/__slide-editor/ping");
                req.Timeout = 400;
                req.Proxy = null;
                using (var res = req.GetResponse())
                using (var reader = new StreamReader(res.GetResponseStream()))
                {
                    if (reader.ReadToEnd() == "slide-editor") return port;
                }
            }
            catch { }
        }
        return 0;
    }

    // 서버는 창 없이 돈다. 편집기 창을 모두 닫으면 서버가 스스로 끝난다 (vite.config.ts 의 AUTO_EXIT)
    static void StartServer(string root)
    {
        if (!Directory.Exists(Path.Combine(root, "node_modules")))
            throw new Exception("필요한 패키지가 설치되어 있지 않습니다.\n먼저 run.bat 을 한 번 실행해 주세요.");
        var psi = new ProcessStartInfo("cmd.exe", "/c npm run dev > \"" + LogFile + "\" 2>&1")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.EnvironmentVariables["SLIDE_EDITOR_AUTO_EXIT"] = "1";
        Process.Start(psi);
    }

    static int WaitForServer()
    {
        DateTime until = DateTime.Now.AddSeconds(StartTimeoutSec);
        while (DateTime.Now < until)
        {
            Thread.Sleep(500);
            int port = FindServer();
            if (port != 0) return port;
        }
        return 0;
    }

    static void OpenBrowser(string url)
    {
        string[] browsers = {
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            Environment.ExpandEnvironmentVariables(@"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        };
        foreach (string browser in browsers)
        {
            if (File.Exists(browser)) { Process.Start(browser, "--app=\"" + url + "\" --start-maximized"); return; }
        }
        Process.Start(url); // 앱 모드를 지원하는 브라우저가 없으면 기본 브라우저
    }
}
