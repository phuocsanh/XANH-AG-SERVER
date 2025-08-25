package testutil

import (
	"database/sql"
	"os"
	"testing"

	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/database"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

// SetupTestDB initializes test database connection
func SetupTestDB(t *testing.T) *database.Queries {
	// Set test environment
	os.Setenv("GO_ENV", "test")

	// Use test database configuration directly
	dsn := "host=localhost port=5432 user=postgres password=123456 dbname=GO_GN_FARM_TEST sslmode=disable"

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skipf("Skipping test: cannot connect to test database: %v", err)
		return nil
	}

	err = db.Ping()
	if err != nil {
		t.Skipf("Skipping test: cannot ping test database: %v", err)
		return nil
	}

	// Create queries instance
	queries := database.New(db)

	// Set global database connection for tests
	global.Pgdbc = db

	return queries
}

// CleanupTestDB cleans up test database
func CleanupTestDB(t *testing.T) {
	if global.Pgdbc != nil {
		// Clean up test data
		_, err := global.Pgdbc.Exec("TRUNCATE TABLE users, products, product_types, product_subtypes RESTART IDENTITY CASCADE")
		if err != nil {
			t.Logf("Warning: Failed to clean test data: %v", err)
		}

		global.Pgdbc.Close()
		global.Pgdbc = nil
	}
}

// CreateTestUser creates a test user for testing
func CreateTestUser(t *testing.T, queries *database.Queries) int32 {
	user, err := queries.AddUserBase(nil, database.AddUserBaseParams{
		UserAccount:  "test@example.com",
		UserPassword: "hashedpassword",
		UserSalt:     "testsalt",
	})
	require.NoError(t, err)

	return user
}
