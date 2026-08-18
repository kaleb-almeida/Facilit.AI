@echo off
echo =======================================
echo Compilando Backend Java Auth...
echo =======================================

if not exist bin mkdir bin

javac -encoding UTF-8 -cp "lib/postgresql-42.7.3.jar" -d bin src/BCrypt.java src/JWT.java src/Db.java src/Server.java

if %errorlevel% neq 0 (
    echo [ERRO] Falha na compilação do código Java!
    pause
    exit /b %errorlevel%
)

echo =======================================
echo Iniciando Servidor Java Auth...
echo =======================================

java -cp "bin;lib/postgresql-42.7.3.jar" Server
