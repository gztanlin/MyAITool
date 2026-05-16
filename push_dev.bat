@echo off
cd /d "%~dp0"

echo === Pushing to GitHub ===
echo.

git config --global --unset http.proxy
git config --global --unset https.proxy

git checkout dev
git add .
git commit -m "feat: add feedback page"
git push origin dev

echo.
echo === Done ===
pause