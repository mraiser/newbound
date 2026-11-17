@echo off
rem Windows counterpart of newbound.sh: build if needed and run from this folder.
setlocal
cd /d "%~dp0"
rem A running newbound.exe - another instance, or the `newbound mcp` tools a
rem Claude Code session starts - is locked, so cargo could not replace it.
rem Windows does allow renaming it: move it aside and put an unlocked copy,
rem timestamp kept, in its place, so an unchanged build stays fresh.
set "EXE=target\release\newbound.exe"
if not exist "%EXE%" goto run
del /q "%EXE%.old-*" >nul 2>&1
set "PARK=%EXE%.old-launcher-%RANDOM%%RANDOM%"
move /y "%EXE%" "%PARK%" >nul 2>&1 || goto run
copy /y "%PARK%" "%EXE%" >nul
:run
cargo run --release --features=serde_support %*
