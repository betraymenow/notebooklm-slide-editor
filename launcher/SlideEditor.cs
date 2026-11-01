// 슬라이드 편집기 실행 프로그램 (install.bat 이 SlideEditor.exe 로 빌드한다)
//  - 인수 없이 실행: 편집기를 열거나, 이미 떠 있으면 그 서버로 브라우저만 연다
//  - 파일 경로를 주면(탐색기 "연결 프로그램"): 그 파일을 편집기에서 바로 연다
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("슬라이드 편집기")]
[assembly: AssemblyProduct("슬라이드 편집기")]
[assembly: AssemblyDescription("NotebookLM 슬라이드 편집기")]

static class Program
{
    const string Title = "슬라이드 편집기";
    const int FirstPort = 3000, LastPort = 3010;   // Vite 는 3000 이 차 있으면 다음 번호를 쓴다
    const int StartTimeoutSec = 60;
    static readonly string[] Extensions = { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".pdf" };

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            string query = args.Length > 0 ? "?open=" + StageFile(root, args[0]) : "";
            int port = FindServer();
            if (port == 0)
            {
                StartServer(root);
                port = WaitForServer();
                if (port == 0) throw new Exception("편집기 서버가 " + StartTimeoutSec + "초 안에 시작되지 않았습니다.\nrun.bat 으로 실행해 오류 메시지를 확인해 주세요.");
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

    // 서버는 최소화된 콘솔 창에서 돈다. 그 창을 닫으면 편집기도 꺼진다
    static void StartServer(string root)
    {
        if (!Directory.Exists(Path.Combine(root, "node_modules")))
            throw new Exception("필요한 패키지가 설치되어 있지 않습니다.\n먼저 run.bat 을 한 번 실행해 주세요.");
        var psi = new ProcessStartInfo("cmd.exe", "/c title NotebookLM 슬라이드 편집기 서버 && npm run dev")
        {
            WorkingDirectory = root,
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Minimized,
        };
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
        string[] chromes = {
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            Environment.ExpandEnvironmentVariables(@"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        };
        foreach (string chrome in chromes)
        {
            if (File.Exists(chrome)) { Process.Start(chrome, url); return; }
        }
        Process.Start(url); // 크롬이 없으면 기본 브라우저
    }
}
