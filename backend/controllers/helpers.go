package controllers

import (
	"net/http"
	"sync"
	"time"

	"github.com/firemex/backend/database"
	"github.com/firemex/backend/models"
	"github.com/gin-gonic/gin"
)

// The dashboard asks for a camera frame several times a second, and every one
// of those requests needs to know who is asking. Looking the user up in the
// database each time means dozens of identical queries per second for a row
// that changes perhaps once a month.
//
// So a user is remembered for a few seconds.
//
// The trade-off, stated plainly: revoking an operator, or changing their role,
// takes effect within userCacheTTL rather than instantly. Five seconds is short
// enough not to matter in practice - the operator's very next frame request is
// already rejected - and long enough to remove almost all of the load.
const userCacheTTL = 5 * time.Second

type cachedUser struct {
	user     models.User
	cachedAt time.Time
}

var (
	userCacheMu sync.RWMutex
	userCache   = map[uint]cachedUser{}
)

func lookupUser(id uint) (models.User, bool) {
	userCacheMu.RLock()
	entry, ok := userCache[id]
	userCacheMu.RUnlock()

	if ok && time.Since(entry.cachedAt) < userCacheTTL {
		return entry.user, true
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return models.User{}, false
	}

	userCacheMu.Lock()
	userCache[id] = cachedUser{user: user, cachedAt: time.Now()}
	userCacheMu.Unlock()

	return user, true
}

// forgetUser drops a cached user immediately.
//
// Called wherever an account is changed, so approving, revoking or renaming
// somebody takes effect at once instead of after userCacheTTL.
func forgetUser(id uint) {
	userCacheMu.Lock()
	delete(userCache, id)
	userCacheMu.Unlock()
}

// FiremeX is organisation-based: a user may only ever see or change records
// that belong to their own organisation. The two helpers below are how every
// controller enforces that, so the rule is written once instead of five times.

// currentUser returns the logged-in user.
//
// On admin routes RequireAdmin has already loaded the user and stored it as
// "currentUser", so no extra query is needed. On ordinary protected routes
// RequireAuth only stores the user id, so we load the user once and cache it
// in the context for anything later in the same request.
//
// It writes the error response itself and returns false when it fails, so the
// caller only has to `return`.
func currentUser(c *gin.Context) (models.User, bool) {
	if value, exists := c.Get("currentUser"); exists {
		if user, ok := value.(models.User); ok {
			return user, true
		}
	}

	value, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		c.Abort()
		return models.User{}, false
	}

	// JWT stores numbers as float64.
	id, ok := value.(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID format"})
		c.Abort()
		return models.User{}, false
	}

	user, found := lookupUser(uint(id))
	if !found {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		c.Abort()
		return models.User{}, false
	}

	c.Set("currentUser", user)
	return user, true
}

// currentOrgID returns the organisation the logged-in user belongs to.
//
// Every account created by FiremeX is linked to an organisation: registering
// an organisation creates its admin, and registering an operator requires an
// existing organisation code. An account with no organisation should therefore
// not exist, and if one does we refuse rather than fall back to showing
// everything - which is what the old code did.
func currentOrgID(c *gin.Context) (uint, bool) {
	user, ok := currentUser(c)
	if !ok {
		return 0, false
	}

	if user.OrganizationID == nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Your account is not linked to an organisation. Please ask an administrator to re-create it.",
		})
		c.Abort()
		return 0, false
	}

	return *user.OrganizationID, true
}
