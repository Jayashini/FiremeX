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
    :: No container exists, check if image exists locally
    docker image inspect ghcr.io/home-assistant/home-assistant:stable >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Found local ghcr.io/home-assistant/home-assistant:stable image.
        echo HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable> .env
    ) else (
        docker image inspect homeassistant/home-assistant:stable >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo Found local homeassistant/home-assistant:stable image.
            echo HOMEASSISTANT_IMAGE=homeassistant/home-assistant:stable> .env
        ) else (
            echo Home Assistant not found locally. Using default ghcr.io/home-assistant/home-assistant:stable.
            echo HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable> .env
        )
    )
)

docker compose up -d
