package ctrls

import (
	"net/http"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/utils"
	"strings"

	"github.com/gorilla/mux"
)

type Databases struct {
	Context
}

func (ctrl Databases) getDBName(r *http.Request) string {
	return mux.Vars(r)["database"]
}

func (ctrl Databases) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		dbName := ctrl.getDBName(r)
		validDBNames := []string{
			missingeps.NAME, fseps.NAME, imdbeps.NAME,
		}

		if utils.ContainsStr(validDBNames, dbName) {
			next.ServeHTTP(w, r)
			return
		}

		ctrl.validationErr(w, map[string]string{
			"name": "name must be one of " + strings.Join(validDBNames, ", "),
		})
	})
}

func (ctrl Databases) Handle(w http.ResponseWriter, r *http.Request) {
	dbName := ctrl.getDBName(r)
	var res utils.DB

	switch dbName {
	case missingeps.NAME:
		res = ctrl.MissingEps.DB
	case fseps.NAME:
		res = ctrl.FSEps.DB
	case imdbeps.NAME:
		res = ctrl.IMDBEps.DB
	}

	ctrl.respond(w, 200, res)
}
