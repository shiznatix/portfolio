package missingeps

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/utils"
	"time"
)

const DB_TORRENTS_NAME = NAME + ".torrents"

type torrentsDBValue = torrent

type searchLog struct {
	Domain       string `json:"domain"`
	SearchTime   int64  `json:"searchTime"`
	Success      bool   `json:"success"`
	ErrorMsg     string `json:"errorMsg,omitempty"`
	ResultsCount int    `json:"resultsCount"`
}

type episode struct {
	utils.DBRecord
	IMDBEpisode    imdbeps.Episode `json:"imdbEpisode"`
	LastSearchTime int64           `json:"lastSearchTime"`
	Ignore         bool            `json:"ignore"`
	Torrents       utils.DB        `json:"torrents"`
	Logs           []string        `json:"logs"`
	SearchLogs     []searchLog     `json:"searchLogs"`
	ctx            context.Context
}

type episodeSearchStatus struct {
	search bool
	logMsg string
	chance int64
}

func newEpisode(ctx context.Context, imdbEp imdbeps.Episode) (episode, error) {
	ep := episode{
		DBRecord: utils.DBRecord{
			ID: utils.DBKey(imdbEp.ID),
		},
		IMDBEpisode: imdbEp,
		Logs:        []string{},
		SearchLogs:  []searchLog{},
		ctx:         ctx,
	}
	db, err := utils.NewDB(DB_TORRENTS_NAME, ep.dbConf())
	if err != nil {
		return ep, err
	}

	ep.Torrents = db

	return ep, nil
}

func (ep *episode) UnmarshalJSON(data []byte) error {
	type alias episode
	aux := &struct {
		Torrents []torrentsDBValue `json:"torrents"`
		*alias
	}{
		alias: (*alias)(ep),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	tDB, err := utils.NewDB(DB_TORRENTS_NAME, ep.dbConf())
	if err != nil {
		return err
	}

	tDB.LoadFromSlice(aux.Torrents)
	ep.Torrents = tDB

	return nil
}

func (ep episode) Torrent(id utils.DBKey) (torrent, bool) {
	t, ok := ep.Torrents.Load(id)
	if !ok {
		return torrent{}, false
	}

	return t.(torrentsDBValue), true
}

func (ep episode) dbConf() utils.DBConfig {
	return utils.DBConfig{
		Ctx:     ep.ctx,
		ValType: torrentsDBValue{},
	}
}

func (ep *episode) log(msg string) {
	ep.Logs = append(ep.Logs, utils.NowStr()+" "+msg)
}

func (ep *episode) logSearch(sr searchRes) {
	sl := searchLog{
		Domain:     sr.domain,
		SearchTime: time.Now().Unix(),
	}

	if sr.err != nil {
		sl.Success = false
		sl.ErrorMsg = sr.err.Error()
		ep.log(fmt.Sprintf("%s search failed '%v'", sr.domain, sr.err))
	} else {
		sl.Success = true
		sl.ResultsCount = len(sr.torrents)
		ep.log(fmt.Sprintf("%s found %d results", sr.domain, len(sr.torrents)))
	}

	ep.SearchLogs = append(ep.SearchLogs, sl)
}

func (ep episode) selectTorrent(torrentId utils.DBKey, transmissionId string) error {
	v, ok := ep.Torrents.Load(torrentId)
	if !ok {
		return errors.New("missing episode torrent not found")
	}

	t := v.(torrentsDBValue)
	t.TransmissionID = transmissionId
	t.log("added")
	ep.Torrents.Store(torrentId, t)
	ep.log("selected torrentId:" + torrentId.String())

	return nil
}

func (ep episode) searchStatus() episodeSearchStatus {
	var chance int64 = 0
	var logMsg string
	var search bool = false

	// TODO do we want to take into account "failed" searches? Or maybe also like consecutive success searches with no results?

	if ep.LastSearchTime == 0 {
		if ep.IMDBEpisode.AirTime < time.Now().AddDate(-1, 0, 0).Unix() {
			chance = 50
			logMsg = "never searched, AirTime > 1 year ago"
		} else {
			chance = 3
			logMsg = "never searched"
		}
	} else {
		daysSinceAir := time.Since(time.Unix(ep.IMDBEpisode.AirTime, 0)).Hours() / 24
		var minDays float64
		var maxDays float64

		if ep.Torrents.Len() == 0 {
			// search was previously run, but no results
			if daysSinceAir < 1 {
				minDays = 0.3
				maxDays = 0.5
			} else if daysSinceAir < 3 {
				minDays = 0.5
				maxDays = 1
			} else if daysSinceAir < 6 {
				minDays = 1
				maxDays = 1.5
			} else if daysSinceAir < 11 {
				minDays = 1.8
				maxDays = 2.5
			} else if daysSinceAir < 31 {
				minDays = 3
				maxDays = 4
			} else if daysSinceAir < 61 {
				minDays = 8
				maxDays = 12
			} else if daysSinceAir < 101 {
				minDays = 10
				maxDays = 20
			} else if daysSinceAir < 201 {
				minDays = 15
				maxDays = 30
			} else if daysSinceAir < 365 {
				minDays = 20
				maxDays = 35
			} else {
				minDays = 30
				maxDays = 90
			}
		} else {
			// previous search was run, and results were found, now we are just getting more up-to-date-results
			if daysSinceAir < 5 {
				minDays = 1.5
				maxDays = 2.5
			} else if daysSinceAir < 15 {
				minDays = 2.5
				maxDays = 4
			} else if daysSinceAir < 30 {
				minDays = 3
				maxDays = 6
			} else if daysSinceAir < 60 {
				minDays = 4
				maxDays = 10
			} else {
				minDays = 7
				maxDays = 14
			}
		}

		minSecs := int64(minDays * 24 * 60 * 60)
		maxSecs := int64(maxDays * 24 * 60 * 60)
		lastSearchCutOffMin := time.Now().Add(-time.Duration(minSecs) * time.Second).Unix()
		lastSearchCutOffMax := time.Now().Add(-time.Duration(maxSecs) * time.Second).Unix()
		srchDaysAgo := utils.ElapsedDaysFloat(ep.LastSearchTime)

		if ep.LastSearchTime > lastSearchCutOffMin {
			search = false
			logMsg = fmt.Sprintf("lastSearch > minDays (%.1f > %.1f)", srchDaysAgo, minDays)
		} else if ep.LastSearchTime > lastSearchCutOffMax {
			logMsg = fmt.Sprintf(
				"lastSearch between min/max days (%.1f <> %.1f,%.1f)",
				srchDaysAgo, minDays, maxDays,
			)
			// minimum number of sync-runs between min and max days
			//   use minimum because each search takes a few seconds and the search time isn't accounted for
			//   so give a higher chance to run the search
			chance = (maxSecs - minSecs) / SYNC_EVERY_MAX_SECS
		} else {
			logMsg = fmt.Sprintf("lastSearch > maxDays (%.1f > %.1f)", srchDaysAgo, maxDays)
			chance = 3
		}
	}

	if !search && (chance > 0 && rand.Int63n(chance) == 0) {
		search = true
	}

	logMsg = fmt.Sprintf("%s chance=%d", logMsg, chance)

	return episodeSearchStatus{
		search: search,
		logMsg: logMsg,
		chance: chance,
	}
}
