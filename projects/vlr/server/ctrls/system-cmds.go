package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/utils"
)

type systemCmdCtxKey struct{}
type systemCmdCtx struct {
	Cmd string `json:"command"`
}

type SystemCmd struct {
	Context
}

func (ctrl SystemCmd) getCtx(r *http.Request) *systemCmdCtx {
	return r.Context().Value(systemCmdCtxKey{}).(*systemCmdCtx)
}

func (ctrl SystemCmd) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &systemCmdCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", nil)
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), systemCmdCtxKey{}, ctx)))
		})
	}
}

func (ctrl SystemCmd) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)
		validCmds := []string{
			"volume", "mute", "stop", "reboot",
		}

		if utils.ContainsStr(validCmds, ctx.Cmd) {
			next.ServeHTTP(w, r)
			return
		}

		ctrl.validationErr(w, map[string]string{
			"cmd": "invalid cmd",
		})
	})
}

func (ctrl SystemCmd) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	var err error
	var res interface{} = true

	switch ctx.Cmd {
	// case "volume":
	// 	err = ctrl.System.SetVol()
	// case "mute":
	// 	err = ctrl.System.ToggleMute()
	case "stop":
		ctrl.System.Close()
	case "reboot":
		err = ctrl.System.Reboot()
	}

	if err != nil {
		ctrl.genericErr(w, "failed cmd "+ctx.Cmd, err)
		return
	}

	ctrl.respond(w, 200, res)
}
