@echo off
setlocal

REM ============================================================
REM  iniciar_mvp.bat
REM  Abre o Google Chrome na tela de extensoes e guia o usuario
REM  pelo carregamento manual do MVP ("Carregar sem compactacao").
REM
REM  Por que nao usamos --load-extension direto? Em perfis novos
REM  do Chrome, o "Modo do desenvolvedor" vem desligado por padrao,
REM  e nesse caso o Chrome ignora silenciosamente a flag de linha
REM  de comando --load-extension (medida de seguranca do proprio
REM  Chrome, nao tem workaround confiavel via linha de comando).
REM  O carregamento manual abaixo funciona em qualquer maquina.
REM ============================================================

REM %~dp0 = pasta onde este .bat esta salvo (raiz do projeto)
set "EXT_PATH=%~dp0"
if "%EXT_PATH:~-1%"=="\" set "EXT_PATH=%EXT_PATH:~0,-1%"

REM Tenta localizar o Chrome nos caminhos padrao de instalacao
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

if "%CHROME_EXE%"=="" (
    echo [ERRO] Nao foi possivel localizar o Google Chrome instalado.
    echo Instale o Chrome ou edite este .bat com o caminho correto do chrome.exe.
    pause
    exit /b 1
)

echo ============================================================
echo   OneClick Cancel - carregamento do MVP
echo ============================================================
echo.
echo A pasta da extensao e:
echo   %EXT_PATH%
echo.
echo O Chrome vai abrir na tela de extensoes. Siga os passos:
echo.
echo   1. Ative o "Modo do desenvolvedor" (canto superior direito).
echo   2. Clique em "Carregar sem compactacao".
echo   3. Selecione a pasta acima (a que contem o manifest.json).
echo   4. Confirme que o card "OneClick Cancel" aparece sem erros.
echo   5. Clique no icone de peca de quebra-cabeca na barra do
echo      Chrome e fixe (pin) o icone da extensao.
echo   6. Clique no icone, escolha Netflix ou Spotify e clique em
echo      "Cancelar assinatura" para testar o fluxo.
echo.
pause

start "" "%CHROME_EXE%" "chrome://extensions/"

endlocal
