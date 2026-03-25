package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/utils"
)

type playerCmdCtxKey struct{}
type playerCmdCtx struct {
	Cmd string `json:"command"`
}

type PlayerCmd struct {
	Context
}

func (ctrl PlayerCmd) getCtx(r *http.Request) *playerCmdCtx {
	return r.Context().Value(playerCmdCtxKey{}).(*playerCmdCtx)
}

func (ctrl PlayerCmd) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &playerCmdCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", nil)
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), playerCmdCtxKey{}, ctx)))
		})
	}
}

func (ctrl PlayerCmd) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)
		validCmds := []string{
			"play-pause", "back", "back-large", "forward", "forward-large",
			"volume-up", "volume-down", "mute", "toggle-fullscreen",
			"close", "empty-playlist", "status",
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

func (ctrl PlayerCmd) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	var err error
	var res interface{} = true

	switch ctx.Cmd {
	case "play-pause":
		err = ctrl.VLC.PlayPause()
	case "back":
		err = ctrl.VLC.Seek("-10S")
	case "back-large":
		err = ctrl.VLC.Seek("-1M")
	case "forward":
		err = ctrl.VLC.Seek("+10S")
	case "forward-large":
		err = ctrl.VLC.Seek("+1M")
	case "volume-up":
		// err = ctrl.VLC.Vol("+10")
		err = ctrl.VLC.KeyPress("Up")
	case "volume-down":
		// err = ctrl.VLC.Vol("-10")
		err = ctrl.VLC.KeyPress("Down")
	case "mute":
		// err = ctrl.VLC.Vol("0")
		err = ctrl.VLC.KeyPress("m")
	case "toggle-fullscreen":
		err = ctrl.VLC.ToggleFullscreen()
		// err = ctrl.VLC.KeyPress("f")
	case "empty-playlist":
		err = ctrl.VLC.EmptyPlaylist()
	case "status":
		res, err = ctrl.VLC.Status()
	case "close":
		ctrl.VLC.Close()
	}

	if err != nil {
		ctrl.genericErr(w, "failed cmd "+ctx.Cmd, err)
		return
	}

	ctrl.respond(w, 200, res)
}
