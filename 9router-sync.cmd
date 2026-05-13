@echo off
REM 9router-sync CLI wrapper for Windows
REM This file is copied to PREFIX directory during installation
REM It runs the actual script from the APP_DIR installation location

REM Determine APP_DIR (default: %USERPROFILE%\.9router-sync)
if defined APP_DIR (
    set "SCRIPT_PATH=%APP_DIR%\bin\9router-sync"
) else (
    set "SCRIPT_PATH=%USERPROFILE%\.9router-sync\bin\9router-sync"
)

node "%SCRIPT_PATH%" %*
exit /b %ERRORLEVEL%
