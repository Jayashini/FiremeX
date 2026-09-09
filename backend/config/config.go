// Package config is the single place where FiremeX reads its settings.
//
// Rule: anything that changes when FiremeX moves to a different machine
// (database location, Home Assistant address, secrets) belongs here and is
// read from the environment. Nothing outside this file should call os.Getenv.
package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// SessionCookie is the name of the cookie that carries the login token.
//
// It exists because the camera feed is rendered by an <img> tag, and an image
// request cannot set an Authorization header - the browser only sends cookies.
// Every fetch() call still uses the header; this is the fallback for tags.
const SessionCookie = "firemex_session"

// devPassword is the throwaway password used by docker-compose for local
// development. If we ever see it in use we warn, so it can never reach a
// customer installation unnoticed.
const devPassword = "secretpassword"

// Config holds every setting FiremeX needs to run.
type Config struct {
	Port        string   // port the API listens on
	DatabaseDSN string   // full database connection string
	JWTSecret   []byte   // key used to sign and verify login tokens
	HAURL       string   // base address of Home Assistant
	HAToken     string   // token used to call the Home Assistant API
	CORSOrigins []string // browser origins allowed to call this API
	DataDir     string   // folder for files FiremeX must keep (e.g. the secret)
}

// C is the one shared copy of the configuration.
// Read it as config.C.JWTSecret, config.C.HAURL, and so on.
var C Config

// Load reads the environment and fills C.
// It MUST be called as the first thing inside main(), after godotenv.Load().
// Do not move this into a package-level variable: Go initialises those before
// main() runs, which would be before the .env file has been read.
func Load() {
	dataDir := env("FIREMEX_DATA_DIR", ".")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Println("config: could not create data dir:", err)
	}

	C = Config{
		Port:        env("PORT", "8080"),
		DatabaseDSN: databaseDSN(),
		HAURL:       env("HA_URL", "http://localhost:8123"),
		HAToken:     env("HA_TOKEN", ""),
		CORSOrigins: splitCSV(env("CORS_ORIGINS", "http://localhost:5173")),
		DataDir:     dataDir,
	}
	C.JWTSecret = []byte(resolveSecret(dataDir))

	if C.HAToken == "" {
		log.Println("config: HA_TOKEN is not set - Home Assistant camera calls will fail")
	}
	if strings.Contains(C.DatabaseDSN, devPassword) {
		log.Println("config: WARNING - using the development database password. Set DATABASE_DSN before any real deployment.")
	}
}

// databaseDSN builds the connection string. A whole DSN can be supplied at
// once with DATABASE_DSN, or the individual pieces can be set separately.
func databaseDSN() string {
	if dsn := os.Getenv("DATABASE_DSN"); dsn != "" {
		return dsn
	}
	return fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		env("DB_HOST", "localhost"),
		env("DB_USER", "admin"),
		env("DB_PASSWORD", devPassword),
		env("DB_NAME", "firemex"),
		env("DB_PORT", "5432"),
		env("DB_SSLMODE", "disable"),
	)
}

// resolveSecret returns the key used to sign login tokens.
//
//  1. JWT_SECRET from the environment wins (development and CI).
//  2. Otherwise reuse the secret saved on disk from a previous run, so that
//     restarting FiremeX does not log every operator out.
//  3. Otherwise generate a fresh random one and save it, so that every
//     installation ends up with its own key without the customer doing
//     anything.
func resolveSecret(dataDir string) string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}

	path := filepath.Join(dataDir, ".firemex_secret")
	if b, err := os.ReadFile(path); err == nil && len(strings.TrimSpace(string(b))) > 0 {
		return strings.TrimSpace(string(b))
	}

	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatal("config: could not generate a signing secret: ", err)
	}
	secret := hex.EncodeToString(buf)

	if err := os.WriteFile(path, []byte(secret), 0o600); err != nil {
		log.Println("config: generated a signing secret but could not save it:", err)
		log.Println("config: operators will be logged out on the next restart")
	} else {
		log.Println("config: generated a new signing secret at", path)
	}
	return secret
}

// env returns the environment value for key, or fallback when it is unset.
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// splitCSV turns "a, b ,c" into []string{"a","b","c"}.
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
