@echo off
setlocal EnableExtensions EnableDelayedExpansion
title JARVIS - GitHub Guncelle

REM ------------------------------------------------------------
REM JARVIS ULTIMATE - Tek tik GitHub push
REM Bu BAT dosyasini Git repository kok klasorune koy ve cift tikla.
REM Repo: https://github.com/kutas13/jarvis.git
REM ------------------------------------------------------------

cd /d "%~dp0"

echo.
echo ============================================
echo   JARVIS - GITHUB OTOMATIK GUNCELLEME
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [HATA] Git bulunamadi.
    echo Git for Windows kurulu olmali.
    pause
    exit /b 1
)

REM Git repo yoksa olustur
if not exist ".git" (
    echo [1/7] Git repository olusturuluyor...
    git init
    if errorlevel 1 goto :error
)

REM Main branch kullan
git branch -M main >nul 2>&1

REM Remote ayarla
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [2/7] GitHub repository baglaniyor...
    git remote add origin https://github.com/kutas13/jarvis.git
) else (
    git remote set-url origin https://github.com/kutas13/jarvis.git
)

REM Guvenli .gitignore kurallari
echo [3/7] Gizli dosyalar korunuyor...
if not exist ".gitignore" type nul > ".gitignore"

call :EnsureIgnore ".env"
call :EnsureIgnore ".env.local"
call :EnsureIgnore ".env.*.local"
call :EnsureIgnore "windows-agent/.env"
call :EnsureIgnore "**/windows-agent/.env"
call :EnsureIgnore "node_modules/"
call :EnsureIgnore ".next/"
call :EnsureIgnore "*.tsbuildinfo"
call :EnsureIgnore "logs/"
call :EnsureIgnore "*.log"

REM Daha once yanlislikla track edilmis secret/build dosyalari varsa index'ten kaldir
git rm -r --cached --ignore-unmatch ".env" ".env.local" "windows-agent/.env" "JARVIS-ULTIMATE-v4/windows-agent/.env" "node_modules" ".next" >nul 2>&1
git rm --cached --ignore-unmatch "tsconfig.tsbuildinfo" "JARVIS-ULTIMATE-v4/tsconfig.tsbuildinfo" >nul 2>&1

echo [4/7] Degisiklikler hazirlaniyor...
git add -A
if errorlevel 1 goto :error

REM Degisiklik yoksa commit atlama
git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo [BILGI] GitHub'a gonderilecek yeni degisiklik yok.
    echo Mevcut branch yine de kontrol edilecek.
) else (
    echo [5/7] Commit olusturuluyor...
    for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set D=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ("%time%") do set T=%%a-%%b
    git commit -m "JARVIS update %date% %time%"
    if errorlevel 1 goto :error
)

echo [6/7] Uzak repository ile senkronize ediliyor...
git fetch origin main >nul 2>&1

REM Remote main varsa rebase dene
git show-ref --verify --quiet refs/remotes/origin/main
if not errorlevel 1 (
    git rebase origin/main
    if errorlevel 1 (
        echo.
        echo [HATA] Git rebase cakismasi olustu.
        echo Once cakismayi cozumleyip tekrar bu BAT'i calistir.
        pause
        exit /b 1
    )
)

echo [7/7] GitHub'a gonderiliyor...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo ============================================
echo   BASARILI - GITHUB GUNCELLENDI
echo ============================================
echo Repo:
echo https://github.com/kutas13/jarvis
echo.
echo Vercel GitHub'a bagliysa otomatik deploy baslar.
echo.
pause
exit /b 0

:EnsureIgnore
findstr /x /c:%1 ".gitignore" >nul 2>&1
if errorlevel 1 echo %~1>>".gitignore"
exit /b 0

:error
echo.
echo ============================================
echo   HATA OLUSTU
echo ============================================
echo Yukaridaki hata mesajini ChatGPT'ye gonder.
echo.
pause
exit /b 1
