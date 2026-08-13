#!/bin/bash

# Check if homeassistant container exists
if docker inspect homeassistant >/dev/null 2>&1; then
    HA_IMAGE=$(docker inspect --format="{{.Config.Image}}" homeassistant)
    echo "Found existing Home Assistant container using image: $HA_IMAGE"
    echo "HOMEASSISTANT_IMAGE=$HA_IMAGE" > .env
else
    # Check if image exists locally
    if docker image inspect ghcr.io/home-assistant/home-assistant:stable >/dev/null 2>&1; then
        echo "Found local ghcr.io/home-assistant/home-assistant:stable image."
        echo "HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable" > .env
    elif docker image inspect homeassistant/home-assistant:stable >/dev/null 2>&1; then
        echo "Found local homeassistant/home-assistant:stable image."
        echo "HOMEASSISTANT_IMAGE=homeassistant/home-assistant:stable" > .env
    else
        echo "Home Assistant not found locally. Using default ghcr.io/home-assistant/home-assistant:stable."
        echo "HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable" > .env
    fi
fi

docker compose up -d
