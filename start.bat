@echo off
SETLOCAL EnableDelayedExpansion

:: Check if homeassistant container exists
docker inspect homeassistant >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    :: Container exists, get its image name
    for /f "tokens=*" %%i in ('docker inspect --format="{{.Config.Image}}" homeassistant') do set HA_IMAGE=%%i
    echo Found existing Home Assistant container using image: !HA_IMAGE!
    echo HOMEASSISTANT_IMAGE=!HA_IMAGE!> .env
) else (
    :: No container exists, check if any homeassistant image exists locally
    set LOCAL_IMAGE=
    for /f "tokens=*" %%i in ('docker images --format "{{.Repository}}:{{.Tag}}" 2^>nul') do (
        echo %%i | findstr "home-assistant" >nul
        if !ERRORLEVEL! EQU 0 (
            set LOCAL_IMAGE=%%i
        )
    )
    
    if defined LOCAL_IMAGE (
        echo Found local Home Assistant image: !LOCAL_IMAGE!
        echo HOMEASSISTANT_IMAGE=!LOCAL_IMAGE!> .env
    ) else (
        echo Home Assistant not found locally. Using default ghcr.io/home-assistant/home-assistant:stable.
        echo HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable> .env
    )
)

docker compose up -d
