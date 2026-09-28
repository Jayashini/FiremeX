@echo off
echo ========================================================
echo   Starting All FiremeX Containers with Docker Compose
echo ========================================================

docker compose up -d --build

echo ========================================================
echo   All FiremeX Containers Started Successfully!
echo   - Home Assistant    : http://localhost:8123
echo   - Frontend UI       : http://localhost:5173
echo   - Backend API       : http://localhost:8080
echo   - AI Model Service  : http://localhost:8100/health
echo   - PostgreSQL DB     : localhost:5432
echo ========================================================
