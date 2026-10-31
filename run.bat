@echo off
title NotebookLM 슬라이드 편집기
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [안내] .env.local 파일이 없어 AI 분석 기능이 동작하지 않습니다. README를 참고해 GEMINI_API_KEY를 넣어 주세요.
)

if not exist "node_modules" (
  echo 처음 실행이라 필요한 패키지를 설치합니다...
  call npm install
  if errorlevel 1 (
    echo [오류] 패키지 설치에 실패했습니다.
    pause
    exit /b 1
  )
)

echo 편집기를 시작합니다. 브라우저가 자동으로 열립니다.
echo 이 창을 닫으면 편집기도 종료됩니다.
echo.
set BROWSER=chrome
call npm run dev -- --open
pause
