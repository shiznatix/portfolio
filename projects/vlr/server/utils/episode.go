package utils

import (
	"fmt"
	"strings"
)

type Episode struct {
	ShowName      string `json:"showName"`
	SeasonName    string `json:"seasonNumber,omitempty"`
	EpisodeName   string `json:"episodeName,omitempty"`
	EpisodeNumber string `json:"episodeNumber"`
}

func (e Episode) DBKey() DBKey {
	return NewDBKey(e.ShowName + e.SeasonName + e.EpisodeNumber + e.EpisodeName)
}

func (e Episode) ExpandEpisodeNumber() []string {
	nums := []string{}
	parts := strings.Split(e.EpisodeNumber, "-")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if OnlyDigits(p) {
			nums = append(nums, p)

			if len(p) == 1 {
				nums = append(nums, PrefixZero(p))
			} else if strings.HasPrefix(p, "0") {
				nums = append(nums, p[1:])
			}
		}
	}

	return nums
}

func (e Episode) LogMeta() string {
	logProps := []any{e.DBKey(), e.ShowName, e.SeasonName, e.EpisodeNumber}
	return fmt.Sprintf("episode{id:%s show:'%s' season:%s episodeNumber:%s}", logProps...)
}
