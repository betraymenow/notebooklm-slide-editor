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

# 1) 아이콘: 파비콘의 크기별 PNG(public/icons)를 모두 담은 .ico — Windows 가 줄여서 흐려지지 않고 맞는 크기를 골라 쓴다
$sizes = 256, 128, 64, 48, 32, 24, 16
Add-Type -AssemblyName System.Drawing

# 256 은 PNG 그대로, 그 아래는 호환성이 가장 좋은 비트맵(BGRA + 투명 마스크)으로 담는다
function Get-IconImage([int]$size) {
  $file = Join-Path $root "public\icons\icon-$size.png"
  if ($size -eq 256) { return ,[System.IO.File]::ReadAllBytes($file) }
  $bmp = New-Object System.Drawing.Bitmap $file
  $mem = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter $mem
  $maskStride = [int]([math]::Ceiling($size / 32.0)) * 4
  $w.Write([UInt32]40); $w.Write([Int32]$size); $w.Write([Int32]($size * 2))   # BITMAPINFOHEADER (높이는 그림 + 마스크)
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]0)
  $w.Write([UInt32]($size * $size * 4 + $maskStride * $size))
  $w.Write([Int32]0); $w.Write([Int32]0); $w.Write([UInt32]0); $w.Write([UInt32]0)
  for ($y = $size - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $size; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $w.Write([byte]$c.B); $w.Write([byte]$c.G); $w.Write([byte]$c.R); $w.Write([byte]$c.A)
    }
  }
  $w.Write((New-Object byte[] ($maskStride * $size)))   # 투명도는 BGRA 의 A 를 쓰므로 마스크는 비워 둔다
  $bmp.Dispose()
  return ,$mem.ToArray()
}

$images = @($sizes | ForEach-Object { ,(Get-IconImage $_) })
$out =New-Object System.IO.BinaryWriter ([System.IO.File]::Create($ico))
$out.Write([UInt16]0); $out.Write([UInt16]1); $out.Write([UInt16]$sizes.Count)   # ICONDIR
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $side = [byte]($sizes[$i] % 256)   # 256 은 0 으로 적는다
  $out.Write($side); $out.Write($side); $out.Write([byte]0); $out.Write([byte]0)
  $out.Write([UInt16]1); $out.Write([UInt16]32); $out.Write([UInt32]$images[$i].Length); $out.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
$images | ForEach-Object { $out.Write([byte[]]$_) }
$out.Close()

# 2) 실행 프로그램 빌드 (.NET Framework 에 들어 있는 C# 컴파일러)
# 편집기 창이 열려 있으면 실행 프로그램이 아이콘을 지키느라 떠 있어 파일이 잠겨 있다
Get-Process SlideEditor -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | ForEach-Object { $_.Kill(); $_.WaitForExit() }
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
& "$env:SystemRoot\System32\ie4uinit.exe" -show  # 바뀐 아이콘이 바로 보이도록 아이콘 캐시를 새로 고친다
Write-Host "등록했습니다. 사진을 오른쪽 클릭 → 연결 프로그램 → '$appName' 을 고르세요."
