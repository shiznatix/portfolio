package imdbeps

import (
	"context"
	"encoding/json"
	"shiznatix/vlr/utils"
	"time"
)

const DB_EPISODES_NAME = NAME + ".eps"

type episodesDBValue = Episode

type show struct {
	utils.DBRecord
	LastCheckTime int64    `json:"lastCheckTime"`
	Name          string   `json:"name"`
	ImdbID        string   `json:"imdbId"`
	Episodes      utils.DB `json:"episodes"`
	ctx           context.Context
}

func newShow(ctx context.Context, name string, imdbID string) (show, error) {
	s := show{
		DBRecord: utils.DBRecord{
			ID: utils.NewDBKey(imdbID),
		},
		Name:   name,
		ImdbID: imdbID,
		ctx:    ctx,
	}

	db, err := utils.NewDB(DB_EPISODES_NAME, s.dbConf())
	if err != nil {
		return s, err
	}

	s.Episodes = db

	return s, nil
}

func (s *show) UnmarshalJSON(data []byte) error {
	type alias show
	aux := &struct {
		Episodes []episodesDBValue `json:"episodes"`
		*alias
	}{
		alias: (*alias)(s),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	epsDB, err := utils.NewDB(DB_EPISODES_NAME, s.dbConf())
	if err != nil {
		return err
	}

	epsDB.LoadFromSlice(aux.Episodes)
	s.Episodes = epsDB

	return nil
}

func (s show) dbConf() utils.DBConfig {
	return utils.DBConfig{
		Ctx:     s.ctx,
		ValType: episodesDBValue{},
	}
}

func (s *show) crawl(ctx context.Context) error {
	c := newCrawler(ctx, *s)
	if err := c.crawl(); err != nil {
		return err
	}

	s.LastCheckTime = time.Now().Unix()
	s.Episodes.LoadFromSlice(c.episodes)

	return nil
}
