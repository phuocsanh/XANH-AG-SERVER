package common

import (
	"gn-farm-go-server/global"

	"go.uber.org/zap"
)

// checkErrorPanic logs the error and panics if the error is not nil
func CheckErrorPanic(err error, errString string) {
	if err != nil {
		global.Logger.Error(errString, zap.Error(err))
		panic(err)
	}
}
