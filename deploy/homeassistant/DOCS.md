# FireMeX 0.1.0

This experimental ARM64 app analyzes camera snapshots from Home Assistant. Use it for development testing and keep your existing fire detection systems in service.

## Installation

In Home Assistant OS, go to Settings → Apps → Install app. Open the top-right menu, select Repositories, and add `https://github.com/Jayashini/FiremeX`. Select FireMeX and choose Install. Supervisor downloads the published ARM64 image.

1. Open FireMeX's Configuration tab and save a random Setup key of at least 32 characters. You can generate one on your Mac with `openssl rand -hex 32`.
2. Start FireMeX and select Open Web UI. Register your organization and enter the same Setup key to create the first administrator.
3. Sign in to FireMeX. Use Add New Device → Home Assistant / CCTV to add a camera that Home Assistant can supply snapshots for.
4. Enable AI tracking and verify that FireMeX continues analyzing frames after you close its page.

FireMeX's database and evidence live under the app's private `/data` directory. Back up the app before installing an update.
