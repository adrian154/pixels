# pixels
 
Online collaborative pixelart akin to r/place. [Try it out!](https://pixels.bithole.dev)

This app is mean to be run in a Docker container behind a reverse proxy, simplifying the configuration:
* The webserver and websocket server always listen on port 80 and 8080, respectively.
* IPs are always obtained via the X-Forwarded-For 