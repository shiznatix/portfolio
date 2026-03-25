package ctrls

import (
	"net/http"
	"shiznatix/vlr/config"
	"shiznatix/vlr/utils"
)

type Shows struct {
	Context
}

func (ctrl Shows) getShowCategory(showName string) string {
	for name, s := range config.Config.ShowCategories {
		if utils.ContainsStr(s, showName) {
			return name
		}
	}

	return "Other"
}

func (ctrl Shows) Handle(w http.ResponseWriter, r *http.Request) {
	cats := map[string][]string{}

	for _, n := range ctrl.FSEps.ShowNames() {
		catName := ctrl.getShowCategory(n)
		if _, ok := cats[catName]; !ok {
			cats[catName] = []string{}
		}

		cats[catName] = append(cats[catName], n)
	}

	ctrl.respond(w, 200, cats)
}
