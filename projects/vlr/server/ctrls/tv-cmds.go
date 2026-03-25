package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/utils"
)

type tvCmdCtxKey struct{}
type tvCmdCtx struct {
	Cmd string `json:"command"`
}

type TvCmd struct {
	Context
}

func (ctrl TvCmd) getCtx(r *http.Request) *tvCmdCtx {
	return r.Context().Value(tvCmdCtxKey{}).(*tvCmdCtx)
}

func (ctrl TvCmd) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &tvCmdCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", nil)
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), tvCmdCtxKey{}, ctx)))
		})
	}
}

func (ctrl TvCmd) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)
		validCmds := []string{
			"on", "off", "volume-up", "volume-down", "mute",
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

func (ctrl TvCmd) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	var err error

	switch ctx.Cmd {
	case "on":
		err = ctrl.HDMICEC.On()
	case "off":
		err = ctrl.HDMICEC.Off()
	case "volume-up":
		err = ctrl.HDMICEC.VolUp()
	case "volume-down":
		err = ctrl.HDMICEC.VolDown()
	case "mute":
		err = ctrl.HDMICEC.Mute()
	}

	if err != nil {
		ctrl.genericErr(w, "failed cmd "+ctx.Cmd, err)
		return
	}

	ctrl.respond(w, 200, true)
}
