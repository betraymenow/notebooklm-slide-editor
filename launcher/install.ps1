# 슬라이드 편집기를 탐색기 "연결 프로그램" 목록에 등록한다 (현재 사용자만, 관리자 권한 불필요)
#   install.bat            → SlideEditor.exe 빌드 + 연결 프로그램 등록 + 바탕화면 바로가기 갱신
#   install.bat -Uninstall → 등록 해제 (바로가기는 run.bat 으로 되돌림)
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$exe = Join-Path $here 'SlideEditor.exe'
$ico = Join-Path $here 'SlideEditor.ico'
$progId = 'SlideEditor.File'
$appName = '슬라이드 편집기'
$extensions = '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.pdf'
$classes = 'Software\Classes'
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "$appName.lnk"
$HKCU = [Microsoft.Win32.Registry]::CurrentUser

# 기존 키는 지우지 않고 열기만 한다 (.png 같은 공용 키를 덮어쓰지 않도록)
function Set-RegValue([string]$key, [string]$name, [string]$value) {
  $k = $HKCU.CreateSubKey($key)
  $k.SetValue($name, $value)
  $k.Close()
}

function Update-Shortcut([string]$target, [string]$icon) {
  $ws = New-Object -ComObject WScript.Shell
  $s = $ws.CreateShortcut($shortcut)
  $s.TargetPath = $target
  $s.WorkingDirectory = $root
  $s.IconLocation = $icon
  $s.Description = "NotebookLM $appName 실행"
  $s.Save()
}

# 탐색기에 연결 정보가 바뀌었다고 알린다
Add-Type -Namespace Win32 -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, int f, System.IntPtr a, System.IntPtr b);'

if ($Uninstall) {
  foreach ($ext in $extensions) {
    $k = $HKCU.OpenSubKey("$classes\$ext\OpenWithProgids", $true)
    if ($k) { $k.DeleteValue($progId, $false); $k.Close() }
  }
  $HKCU.DeleteSubKeyTree("$classes\$progId", $false)
  $HKCU.DeleteSubKeyTree("$classes\Applications\SlideEditor.exe", $false)
  Update-Shortcut (Join-Path $root 'run.bat') "$env:SystemRoot\System32\imageres.dll,186"
  [Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
  Write-Host '연결 프로그램 등록을 해제했습니다.'
  return
}

# 1) 아이콘: 파란 둥근 사각형에 흰 슬라이드 모양 (PNG 를 담은 .ico)
Add-Type -AssemblyName System.Drawing
$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 56
$path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90); $path.AddArc(0, $size - $r, $r, $r, 90, 90)
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 99, 235))), $path)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$g.FillRectangle($white, 40, 60, 176, 120)
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 99, 235))
$g.FillRectangle($blue, 62, 84, 96, 16); $g.FillRectangle($blue, 62, 112, 132, 10); $g.FillRectangle($blue, 62, 134, 110, 10)
$g.FillRectangle($white, 118, 180, 20, 30); $g.FillRectangle($white, 84, 206, 88, 12)
$g.Dispose()
$png = New-Object System.IO.MemoryStream
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $png.ToArray()
$out = New-Object System.IO.BinaryWriter ([System.IO.File]::Create($ico))
$out.Write([UInt16]0); $out.Write([UInt16]1); $out.Write([UInt16]1)             # ICONDIR
$out.Write([byte]0); $out.Write([byte]0); $out.Write([byte]0); $out.Write([byte]0) # 256x256
$out.Write([UInt16]1); $out.Write([UInt16]32); $out.Write([UInt32]$bytes.Length); $out.Write([UInt32]22)
$out.Write($bytes)
$out.Close()

# 2) 실행 프로그램 빌드 (.NET Framework 에 들어 있는 C# 컴파일러)
$csc = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
& $csc /nologo /target:winexe /codepage:65001 /optimize "/win32icon:$ico" /r:System.Windows.Forms.dll "/out:$exe" (Join-Path $here 'SlideEditor.cs')
if ($LASTEXITCODE -ne 0) { throw '실행 프로그램 빌드에 실패했습니다.' }

# 3) 연결 프로그램 등록
$command = "`"$exe`" `"%1`""
Set-RegValue "$classes\$progId" '' "$appName 파일"
Set-RegValue "$classes\$progId" 'FriendlyTypeName' "$appName 파일"
Set-RegValue "$classes\$progId\DefaultIcon" '' "`"$exe`",0"
Set-RegValue "$classes\$progId\shell\open" 'FriendlyAppName' $appName
Set-RegValue "$classes\$progId\shell\open\command" '' $command

Set-RegValue "$classes\Applications\SlideEditor.exe" 'FriendlyAppName' $appName
Set-RegValue "$classes\Applications\SlideEditor.exe\DefaultIcon" '' "`"$exe`",0"
Set-RegValue "$classes\Applications\SlideEditor.exe\shell\open\command" '' $command
foreach ($ext in $extensions) {
  Set-RegValue "$classes\Applications\SlideEditor.exe\SupportedTypes" $ext ''
  Set-RegValue "$classes\$ext\OpenWithProgids" $progId ''
}

# 4) 바탕화면 바로가기도 이 실행 프로그램으로 (이미 떠 있는 편집기를 다시 쓴다)
Update-Shortcut $exe "$exe,0"

[Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host "등록했습니다. 사진을 오른쪽 클릭 → 연결 프로그램 → '$appName' 을 고르세요."
