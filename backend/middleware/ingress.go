package middleware

import (
	"net"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
)

const ingressPrefixKey = "firemex.ingressPrefix"

var ingressPath = regexp.MustCompile(`^/api/hassio_ingress/[A-Za-z0-9_-]+/?$`)

// RequireIngress checks the TCP peer before using any Supervisor headers.
func RequireIngress(c *gin.Context) {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil || host != "172.30.32.2" {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	prefix := c.GetHeader("X-Ingress-Path")
	if !ingressPath.MatchString(prefix) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	if prefix[len(prefix)-1] == '/' {
		prefix = prefix[:len(prefix)-1]
	}
	c.Set(ingressPrefixKey, prefix)

	switch c.Request.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
	default:
		// A browser needs CORS permission to send this header across origins.
		// HAOS mode does not grant that permission. This also works on LAN HTTP.
		if c.GetHeader("X-FireMeX-Request") != "1" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "FireMeX requires a same-origin request"})
			return
		}
	}
	c.Next()
}

func IngressPrefix(c *gin.Context) string {
	return c.GetString(ingressPrefixKey)
}
