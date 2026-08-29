@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Once install.bat calistir.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo .env olusturuldu. Lutfen once duzenle.
  notepad .env
  pause
  exit /b 1
)
.venv\Scripts\python.exe agent.py
pause
