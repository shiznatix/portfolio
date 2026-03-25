package imdbeps

import "shiznatix/vlr/utils"

type Episode struct {
	utils.Episode
	utils.DBRecord
	ShowID  utils.DBKey `json:"showId"`
	AirTime int64       `json:"airTime"`
}

func newEpisode(showID utils.DBKey, ep utils.Episode, airTime int64) Episode {
	return Episode{
		DBRecord: utils.DBRecord{
			ID: ep.DBKey(),
		},
		ShowID:  showID,
		Episode: ep,
		AirTime: airTime,
	}
}
