package ctrls

import (
	"net/http"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/vlc"
)

type playlistItem struct {
	PlaylistItem vlc.PlaylistItem `json:"vlcItem"`
	FSEpisode    fseps.Episode    `json:"fsEpisode"`
}
type PlaylistGet struct {
	Context
}

func (ctrl PlaylistGet) Handle(w http.ResponseWriter, r *http.Request) {
	pl, err := ctrl.VLC.Playlist()
	if err != nil {
		ctrl.genericErr(w, "failed to get current playlist", err)
		return
	}
	items := []playlistItem{}

	for _, item := range pl {
		i := playlistItem{
			PlaylistItem: item,
		}
		ep, ok := ctrl.FSEps.FindByPath(item.Path)
		if ok {
			i.FSEpisode = ep
		}
		items = append(items, i)
	}

	ctrl.respond(w, 200, items)
}
