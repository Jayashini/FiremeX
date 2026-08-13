#!/bin/bash

# Check if homeassistant container exists
if docker inspect homeassistant >/dev/null 2>&1; then
    HA_IMAGE=$(docker inspect --format="{{.Config.Image}}" homeassistant)
    echo "Found existing Home Assistant container using image: $HA_IMAGE"
    echo "HOMEASSISTANT_IMAGE=$HA_IMAGE" > .env
else
    # Check if any homeassistant image exists locally
    LOCAL_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "home-assistant" | head -n 1)
    
    if [ -n "$LOCAL_IMAGE" ]; then
        echo "Found local Home Assistant image: $LOCAL_IMAGE"
        echo "HOMEASSISTANT_IMAGE=$LOCAL_IMAGE" > .env
    else
        echo "Home Assistant not found locally. Using default ghcr.io/home-assistant/home-assistant:stable."
        echo "HOMEASSISTANT_IMAGE=ghcr.io/home-assistant/home-assistant:stable" > .env
    fi
fi

docker compose up -d
