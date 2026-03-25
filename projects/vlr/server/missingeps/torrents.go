package missingeps

import (
	"regexp"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
)

var reg = regexp.MustCompile("[^0-9A-Za-z ]")

type searchRes struct {
	domain   string
	torrents []torrent
	err      error
}

func findTorrents(syncConf SyncConfig, imdbEp imdbeps.Episode) ([]searchRes, error) {
	s1337 := site1337{
		domain: "1337x.to",
		log: logger.Get("torrents.1337", colors.LoggerTorrents1337Color),
	}
	res1337, err1337 := s1337.find(syncConf, imdbEp)

	return []searchRes{
		{
			domain:   s1337.domain,
			torrents: res1337,
			err:      err1337,
		},
	}, nil
}

type torrent struct {
	utils.DBRecord
	vlrSearchResultEntry
	TransmissionID string   `json:"transmissionId"`
	Active         bool     `json:"active"`
	Logs           []string `json:"logs"`
}

func newTorrent(res vlrSearchResultEntry) torrent {
	return torrent{
		DBRecord: utils.DBRecord{
			ID: utils.NewDBKey(res.MagnetLink),
		},
		vlrSearchResultEntry: res,
		TransmissionID:       "",
		Logs:                 []string{},
		Active:               true,
	}
}

func (t *torrent) log(msg string) {
	t.Logs = append(t.Logs, utils.NowStr()+" transmissionId:"+t.TransmissionID+" "+msg)
}

type site1337 struct {
	domain string
	log    logger.Logger
}

func (site site1337) find(syncConf SyncConfig, imdbEp imdbeps.Episode) ([]torrent, error) {
	searchPostfix := "s" + utils.PrefixZero(imdbEp.SeasonName) + "e" + utils.PrefixZero(imdbEp.EpisodeNumber)
	searchTerm := reg.ReplaceAllString(imdbEp.ShowName, "${1}") + " " + searchPostfix
	results, err := vlrSearch(syncConf.VLRSearchURL, vlrSearchBody{
		URL:         "https://" + site.domain,
		SearchStr:   searchTerm,
		ResMatchStr: searchPostfix,
		MaxResults:  syncConf.MaxResults,
	})
	if err != nil {
		return nil, err
	}

	if len(results) > 0 {
		site.log.Infof("found %d torrents for %s", len(results), imdbEp.LogMeta())
	}

	torrents := []torrent{}
	for _, r := range results {
		torrents = append(torrents, newTorrent(r))
	}

	return torrents, nil
}
