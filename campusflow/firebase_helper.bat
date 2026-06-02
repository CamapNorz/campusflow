@echo off

:menu
cls
echo ======================
echo Firebase Helper
echo ======================
echo 1 - Local Test
echo 2 - Deploy All
echo 3 - Deploy Hosting
echo 4 - Login
echo 5 - Exit
echo.

set /p choice=Select:

if "%choice%"=="1" goto local
if "%choice%"=="2" goto deploy
if "%choice%"=="3" goto hosting
if "%choice%"=="4" goto login
if "%choice%"=="5" goto end

goto menu

:local
firebase emulators:start
pause
goto menu

:deploy
firebase deploy
pause
goto menu

:hosting
firebase deploy --only hosting
pause
goto menu

:login
firebase login
pause
goto menu

:end
exit