//go:build wireinject

package wire

import (
	"database/sql" // Assuming DB provider returns *sql.DB

	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/impl/user"

	"github.com/google/wire"
)

// Database provider set (Example - replace with your actual DB provider)
var dbProviderSet = wire.NewSet(
        NewPostgresDB, // Assumes NewPostgresDB() *sql.DB exists
        database.New, // Use the exported New function from sqlc
        // Bind *sql.DB to the DBTX interface that database.New expects
        wire.Bind(new(database.DBTX), new(*sql.DB)),
)

// Service provider set for User Auth
var userAuthServiceSet = wire.NewSet(
        user.NewUserAuthImpl,
        // Bind the implementation to the interface
        // Ensure sUserAuth is exported (SUserAuth) in impl package
        wire.Bind(new(service.IUserAuth), new(*user.SUserAuth)), // Use exported SUserAuth
)

// Initialize only the necessary dependencies for UserAuth service registration
// This function might not need to return anything specific for the current router setup,
// as controllers access the service via global functions (service.UserAuth()).
// Returning an error ensures dependencies were built correctly.
func InitUserAuthService() (service.IUserAuth, error) {
        wire.Build(
                dbProviderSet,
                userAuthServiceSet,
                // We don't explicitly call service.InitUserAuth here.
                // Wire handles injecting the created IUserAuth implementation where needed,
                // or we can call InitUserAuth manually after this function returns.
                // Let's assume manual initialization for now or reliance on wire injection if IUserAuth is requested elsewhere.
        )
        // The return value isn't strictly necessary if InitUserAuth is called manually later,
        // but Wire requires a return value matching one of the providers.
        return nil, nil // Return nil for now, actual instance is created by Wire
}

// --- Helper function for DB (Example) ---
// You should have a proper way to provide your DB connection.
func NewPostgresDB() *sql.DB {
        // This should return your actual initialized *sql.DB connection
        // return global.Pgdbc // Assuming global.Pgdbc is *sql.DB
        // Need to ensure global.Pgdbc is initialized before wire runs, or provide it differently.
        // Returning nil will cause wire to fail if DB is needed.
        // Let's assume global.Pgdbc is initialized elsewhere for now.
        if global.Pgdbc == nil {
        // If using sqlc with *sql.DB, global.Pgdbc needs to be initialized.
        // If using sqlc with *gorm.DB (global.Pgdb), you might need a different NewQueries.
        // Assuming sqlc uses *sql.DB and global.Pgdbc exists from postgresc.go init.
                panic("global.Pgdbc is nil, ensure postgresc is initialized before wire")
        }
        return global.Pgdbc
}
// --- Deprecated User Router Handler ---
// Keep the old function signature but build the new dependencies.
// It doesn't return UserController anymore, but the signature might be expected elsewhere.
// Returning nil, nil signals successful dependency build without the old controller.
// func InitUserRouterHanlder() (*controller.UserController, error) {
//      wire.Build(
//              dbProviderSet,
//              userLoginServiceSet,
//      )
//      return nil, nil
// }
