@echo off
rem 바탕화면에 '슬라이드 편집기' 바로가기를 만든다 (이미 있으면 새로 고친다)
rem launcher\install.bat 으로 실행 프로그램을 만들어 두었으면 그것을, 아니면 run.bat 을 연결한다
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "TARGET=%ROOT%\run.bat"
set "ICON=%SystemRoot%\System32\imageres.dll,186"
if exist "%ROOT%\launcher\SlideEditor.exe" (
  set "TARGET=%ROOT%\launcher\SlideEditor.exe"
  set "ICON=%ROOT%\launcher\SlideEditor.exe,0"
)

rem 한글이 명령줄에서 깨지는 콘솔도 있어서 바로가기 이름 '슬라이드 편집기'는 글자 코드로 넘긴다
powershell -NoProfile -ExecutionPolicy Bypass -Command "$name = -join [char[]](0xC2AC,0xB77C,0xC774,0xB4DC,0x20,0xD3B8,0xC9D1,0xAE30); $s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) ($name + '.lnk'))); $s.TargetPath = $env:TARGET; $s.WorkingDirectory = $env:ROOT; $s.IconLocation = $env:ICON; $s.Description = 'NotebookLM Slide Editor'; $s.Save()"
if errorlevel 1 (
  echo [오류] 바로가기를 만들지 못했습니다.
  pause
  exit /b 1
)

echo 바탕화면에 '슬라이드 편집기' 바로가기를 만들었습니다.
echo 연결 대상: %TARGET%
pause
