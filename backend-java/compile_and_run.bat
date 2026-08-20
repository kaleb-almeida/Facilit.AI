@echo off
echo =======================================
echo Compilando e Iniciando Backend Java Auth com Maven...
echo =======================================

call mvn clean package
if %errorlevel% neq 0 (
    echo [ERRO] Falha na compilação do código Java com Maven!
    pause
    exit /b %errorlevel%
)

echo =======================================
echo Iniciando Servidor...
echo =======================================
java -jar target/servidor-auth-1.0-SNAPSHOT.jar
