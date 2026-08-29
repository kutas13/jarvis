@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  set PY=py
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python bulunamadi. Python 3.11+ kurup tekrar calistir.
    pause
    exit /b 1
  )
  set PY=python
)
if not exist .venv %PY% -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if not exist .env copy .env.example .env >nul
echo.
echo Kurulum tamamlandi. .env dosyasini duzenle, sonra run.bat calistir.
pause
