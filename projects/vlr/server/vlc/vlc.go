package vlc

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os/exec"
	"path/filepath"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	vlcctrl "github.com/CedArctic/go-vlc-ctrl"
)

type VLC struct {
	ctx   context.Context
	mutex *sync.Mutex
	log   logger.Logger
	ctrl  vlcctrl.VLC
	proc  *process
}

type Config struct {
	Ctx            context.Context
	IP             string
	Port           int
	Password       string
	ScreensaverURL string
}

type cmdConfig struct {
	run       func() error
	startProc bool
}

type rawStatus struct {
	State         string                `json:"state"`
	Position      float64               `json:"position"`
	Fullscreen    utils.ConvertibleBool `json:"fullscreen"`
	SubtitleDelay float64               `json:"subtitledelay"`
	Information   struct {
		Category map[string]struct {
			Type     string `json:"type"`
			Language string `json:"language"`
			Channels string `json:"channels"`
			FileName string `json:"filename"`
			Duration string `json:"DURATION"`
		} `json:"category"`
	} `json:"information"`
}
type statusMeta struct {
	FileName string `json:"fileName"`
	Duration string `json:"duration"`
}

type Status struct {
	State          string          `json:"state"`
	Position       float64         `json:"position"`
	Fullscreen     bool            `json:"fullscreen"`
	AudioTracks    []AudioTrack    `json:"audioTracks"`
	SubtitleTracks []SubtitleTrack `json:"subtitleTracks"`
	SubtitleDelay  float64         `json:"subtitleDelay"`
	Meta           statusMeta      `json:"meta"`
}

type SubtitleTrack struct {
	ID       int    `json:"id"`
	Language string `json:"language"`
}

type AudioTrack struct {
	ID       int    `json:"id"`
	Language string `json:"language"`
}

type PlaylistItem struct {
	ID       int    `json:"-"`
	ItemName string `json:"itemName"`
	FileName string `json:"fileName"`
	Path     string `json:"filePath"`
	Playing  bool   `json:"playing"`
}

func New(c Config) VLC {
	v := VLC{
		mutex: &sync.Mutex{},
		ctx:   c.Ctx,
		log:   logger.Get("vlc", colors.LoggerVLCColor),
		proc: &process{
			ctx:      c.Ctx,
			log:      logger.Get("vlc-proc", colors.LoggerVLCProcessColor),
			password: c.Password,
		},
	}

	ctrl, _ := vlcctrl.NewVLC(c.IP, c.Port, c.Password)
	v.ctrl = ctrl

	if c.ScreensaverURL != "" {
		v.startScreensaverMonitor(c.ScreensaverURL)
	}

	return v
}

func (v VLC) command(name string, c cmdConfig) error {
	v.log.Infof("run command name:'%s'", name)

	v.mutex.Lock()
	defer v.mutex.Unlock()

	if utils.IsCanceled(v.ctx) {
		return errors.New("context was canceled")
	}

	if !v.proc.running {
		if c.startProc {
			if err := v.proc.start(); err != nil {
				return err
			}
		} else {
			return nil
		}
	}

	return c.run()
}

func (v VLC) startScreensaverMonitor(screensaverURL string) {
	go func() {
		log := logger.Get("vlc-scrnsvr", colors.LoggerVLCScreensaverColor)
		ticker := time.NewTicker(5 * time.Second)
		playlistEndedHits := 0
		procClosedHits := 0
		playlistEndedHitsMax := 2 // 10 seconds
		procClosedHitsMax := 120  // 10 minutes

		for {
			select {
			case <-v.ctx.Done():
				log.Info("stopping vlc screensaver worker")
				ticker.Stop()
				return
			case <-ticker.C:
				if v.proc.running {
					procClosedHits = 0

					s, _ := v.Status()
					if s.State == "stopped" && s.Meta.FileName == "" && s.Position == 0 {
						playlistEndedHits++
					} else {
						playlistEndedHits = 0

						if strings.HasSuffix(screensaverURL, s.Meta.FileName) && !s.Fullscreen {
							if err := v.Fullscreen(); err != nil {
								log.Err(err, "failed to fullscreen screensaver")
							}
						}
					}
				} else {
					playlistEndedHits = 0
					procClosedHits++
				}

				if playlistEndedHits >= playlistEndedHitsMax || procClosedHits >= procClosedHitsMax {
					log.Infof("starting screensaver plHits:%d closedHits:%d", playlistEndedHits, procClosedHits)

					playlistEndedHits = 0
					procClosedHits = 0

					v.EmptyPlaylist()
					v.AddStreamURL(screensaverURL)
					v.Play(0)
					time.Sleep(1 * time.Second)
					v.Fullscreen()
				}
			}
		}
	}()
}

func (v VLC) Status() (Status, error) {
	s := Status{
		State: "closed",
	}
	err := v.command("status", cmdConfig{
		run: func() error {
			res, err := v.ctrl.RequestMaker("/requests/status.json")
			if err != nil {
				return nil
			}

			// fmt.Println(res) // UNCOMMENT TO DEBUG
			raw := rawStatus{}
			err = json.Unmarshal([]byte(res), &raw)
			if err != nil {
				return err
			}

			subs := []SubtitleTrack{}
			audio := []AudioTrack{}
			meta := statusMeta{}

			for k, c := range raw.Information.Category {
				if k == "meta" {
					meta.FileName = c.FileName
					meta.Duration = c.Duration
					continue
				}

				prts := strings.Split(k, " ")
				if len(prts) < 2 {
					v.log.Errorf("un-parsable stream name:'%s' type:'%s'", k, c.Type)
					continue
				}
				id := utils.StrToInt(prts[1])

				switch c.Type {
				case "Subtitle":
					subs = append(subs, SubtitleTrack{
						ID:       id,
						Language: c.Language,
					})
				case "Audio":
					audio = append(audio, AudioTrack{
						ID:       id,
						Language: c.Language,
					})
				}
			}

			sort.Slice(audio, func(i, j int) bool {
				return audio[i].ID < audio[j].ID
			})
			sort.Slice(subs, func(i, j int) bool {
				return subs[i].ID < subs[j].ID
			})

			s.Fullscreen = bool(raw.Fullscreen)
			s.State = raw.State
			s.AudioTracks = audio
			s.SubtitleTracks = subs
			s.SubtitleDelay = raw.SubtitleDelay
			s.Position = raw.Position
			s.Meta = meta

			return nil
		},
	})

	return s, err
}

func (v VLC) Add(path string) error {
	// & is not encoded with PathEscape but UrlEscape encodes in a way VLC doesn't like
	escPath := strings.ReplaceAll(url.PathEscape(path), "&", "%26")

	return v.command("add", cmdConfig{
		startProc: true,
		run: func() error {
			return v.ctrl.Add(escPath)
		},
	})
}

func (v VLC) AddStreamURL(streamURL string) error {
	escURL := url.QueryEscape(streamURL)

	return v.command("addStreamURL", cmdConfig{
		startProc: true,
		run: func() error {
			return v.ctrl.Add(escURL)
		},
	})
}

func (v VLC) Delete(itemId int) error {
	return v.command("delete", cmdConfig{
		run: func() error {
			return v.ctrl.Delete(itemId)
		},
	})
}

func (v VLC) EmptyPlaylist() error {
	return v.command("emptyPlaylist", cmdConfig{
		run: func() error {
			return v.ctrl.EmptyPlaylist()
		},
	})
}

func (v VLC) Play(itemId int) error {
	return v.command("play", cmdConfig{
		run: func() error {
			return v.ctrl.Play(itemId)
		},
	})
}

func (v VLC) Playlist() ([]PlaylistItem, error) {
	pl := []PlaylistItem{}
	err := v.command("playlist", cmdConfig{
		run: func() error {
			currPl, err := v.ctrl.Playlist()
			if err != nil {
				return err
			}

			for _, f := range currPl.Children[0].Children {
				path, err := url.PathUnescape(f.URI)
				if err != nil {
					v.log.Err(err, "playlist path could not be un-escaped")
					continue
				}
				id, err := strconv.Atoi(f.ID)
				if err != nil {
					v.log.Err(err, "playlist item did not contain an id")
					continue
				}

				path = strings.Replace(path, "file://", "", 1)
				_, fileName := filepath.Split(path)

				pl = append(pl, PlaylistItem{
					ID:       id,
					Path:     path,
					Playing:  f.Current == "current",
					ItemName: f.Name,
					FileName: fileName,
				})
			}

			return nil
		},
	})

	if err != nil {
		return pl, err
	}

	return pl, nil
}

func (v VLC) Previous() error {
	pl, err := v.Playlist()
	if err != nil {
		return err
	}

	return v.command("previous", cmdConfig{
		run: func() error {
			for k, item := range pl {
				if item.Playing {
					if k == 0 {
						return nil
					}

					return v.ctrl.Play(pl[k-1].ID)
				}
			}

			return v.ctrl.Play(pl[len(pl)-1].ID)
		},
	})
}

func (v VLC) Next() error {
	pl, err := v.Playlist()
	if err != nil {
		return err
	}

	return v.command("next", cmdConfig{
		run: func() error {
			for k, item := range pl {
				if item.Playing {
					if k == len(pl)-1 {
						return nil
					}

					return v.ctrl.Play(pl[k+1].ID)
				}
			}

			return v.ctrl.Play(0)
		},
	})
}

func (v VLC) PlayPause() error {
	s, err := v.Status()
	if err != nil {
		return err
	}

	return v.command("playPause", cmdConfig{
		run: func() error {
			switch s.State {
			case "playing":
				return v.ctrl.ForcePause()
			case "paused":
				return v.ctrl.Resume()
			case "stopped":
				return v.ctrl.Play(0)
			}

			return nil
		},
	})
}

func (v VLC) Seek(amount string) error {
	return v.command("seek", cmdConfig{
		run: func() error {
			return v.ctrl.Seek(amount)
		},
	})
}

func (v VLC) KeyPress(key string) error {
	return v.command("key", cmdConfig{
		run: func() error {
			return exec.Command("wtype", "-k", key).Run()
		},
	})
}

// func (v VLC) Vol(vol string) error {
// 	return v.command("vol", cmdConfig{
// 		run: func() error {
// 			return v.ctrl.Volume(vol)
// 		},
// 	})
// }

func (v VLC) Fullscreen() error {
	s, err := v.Status()
	if err != nil {
		return err
	}

	if s.Fullscreen {
		return nil
	}

	return v.command("fullscreen", cmdConfig{
		run: func() error {
			return v.ctrl.ToggleFullscreen()
		},
	})
}

func (v VLC) ToggleFullscreen() error {
	return v.command("toggleFullscreen", cmdConfig{
		startProc: true,
		run: func() error {
			return v.ctrl.ToggleFullscreen()
		},
	})
}

func (v VLC) SetSubtitleTrack(track int) error {
	return v.command("setSubtitleTrack", cmdConfig{
		run: func() error {
			return v.ctrl.SelectSubtitleTrack(track)
		},
	})
}

func (v VLC) SetAudioTrack(track int) error {
	return v.command("setAudioTrack", cmdConfig{
		run: func() error {
			return v.ctrl.SelectAudioTrack(track)
		},
	})
}

func (v VLC) SetSubtitleDelay(delay float64) error {
	return v.command("setSubtitleDelay", cmdConfig{
		run: func() error {
			return v.ctrl.SubDelay(delay)
		},
	})
}

func (v VLC) Close() error {
	return v.proc.stop()
}
