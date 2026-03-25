package fseps

import (
	"errors"
	"math/rand"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/vlc"
	"sort"
)

type RandomSlot struct {
	Shows []string `json:"shows"`
}

func (rs RandomSlot) showNames() []string {
	showNames := utils.Unique(rs.Shows)

	rand.Shuffle(len(showNames), func(i, j int) {
		showNames[i], showNames[j] = showNames[j], showNames[i]
	})

	return showNames
}

type RandomConfig struct {
	Amount   int
	Slots    []RandomSlot
	Playlist []vlc.PlaylistItem
}

type random struct {
	fe        FileSystemEpisodes
	amount    int
	slots     []RandomSlot
	skipPaths []string
	episodes  []dbValue
}

func (r *random) Episodes() ([]dbValue, error) {
	if len(r.slots) == 0 {
		return r.episodes, nil
	}

	var slot RandomSlot
	var showNames []string
	var showName string
	group := []dbValue{}

	for i := 0; i < r.amount; i++ {
		if len(r.slots) > i {
			if names := r.slots[i].showNames(); len(names) > 0 {
				r.addEpisodesGroup(group)

				showNames = names
				slot = r.slots[i]
				group = []dbValue{}
			}
		}

		if len(showNames) == 0 {
			return r.episodes, errors.New("no show names before looking for an episode")
		}

		var episode Episode
		didReset := false

		for episode.FilePath == "" {
			showName, showNames = showNames[0], showNames[1:]
			ep, ok := r.episode(r.fe.ShowEpisodes(showName))
			if ok {
				episode = ep
			}

			if len(showNames) == 0 {
				if didReset {
					return r.episodes, errors.New("no episodes available for any shows in slot")
				}

				showNames = slot.showNames()
				didReset = true
			}
		}

		group = append(group, episode)
		r.skipPaths = append(r.skipPaths, episode.FilePath)
	}

	r.addEpisodesGroup(group)

	if len(r.episodes) == 0 {
		return r.episodes, errors.New("no episodes found")
	} else if len(r.episodes) != r.amount {
		return r.episodes, errors.New("episodes count did not match config amount")
	}

	return r.episodes, nil
}

func (r *random) episode(allShowEps []Episode) (dbValue, bool) {
	playable := []dbValue{}
	cNeverPlayed := 0

	for _, ep := range allShowEps {
		skipPath := utils.ContainsStr(r.skipPaths, ep.FilePath)

		if !ep.SkipInRandom && !skipPath {
			playable = append(playable, ep)
			if ep.LastPlayedTime == 0 {
				cNeverPlayed = cNeverPlayed + 1
			}
		}
	}

	// shuffle our playable episodes
	if cNeverPlayed > 0 {
		i := 0
		for _, p := range playable {
			if p.LastPlayedTime == 0 {
				playable[i] = p
				i++
			}
		}
		playable = playable[:i]

		rand.Shuffle(len(playable), func(i, j int) {
			playable[i], playable[j] = playable[j], playable[i]
		})
	} else {
		sort.Slice(playable, func(i, j int) bool {
			flipIt := rand.Intn(9)
			if flipIt == 2 {
				origI := i
				origJ := j
				i = origJ
				j = origI
			}
			left := playable[i]
			right := playable[j]

			if left.PlayedCount == right.PlayedCount {
				return left.LastPlayedTime < right.LastPlayedTime
			}

			return left.PlayedCount < right.PlayedCount
		})
	}

	if len(playable) == 0 {
		return dbValue{}, false
	}

	return playable[0], true
}

func (r *random) addEpisodesGroup(group []dbValue) {
	if len(group) == 0 {
		return
	}

	// last randomization since we can have more episodes than distinct shows
	// and we don't want the order to always be exactly the same.
	rand.Shuffle(len(group), func(i, j int) {
		group[i], group[j] = group[j], group[i]
	})

	for _, ep := range group {
		r.episodes = append(r.episodes, ep)
	}
}
