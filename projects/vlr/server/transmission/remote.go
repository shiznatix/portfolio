package transmission

import (
	"context"
	"errors"
	"os/exec"
	"regexp"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"sort"
	"strconv"
	"strings"
	"time"
)

var multiSpaceRegex = regexp.MustCompile(`\s{2,}`)

type Remote struct {
	srvAddr string
	log     logger.Logger
}

func NewRemote(srvAddr string) Remote {
	return Remote{
		srvAddr: srvAddr,
		log:     logger.Get("transmission.remote", colors.LoggerTransmissionRemoteColor),
	}
}

func (r Remote) Add(link string) (string, error) {
	dlsBefore, err := r.List()
	if err != nil {
		return "", err
	}

	if _, err := r.command("--add", link); err != nil {
		return "", err
	}

	dlsAfter, err := r.List()
	if err != nil {
		return "", err
	}

	beforeIds := downloadIds(dlsBefore)
	afterIds := downloadIds(dlsAfter)

	for _, v := range afterIds {
		if !utils.ContainsStr(beforeIds, v) {
			return v, nil
		}
	}

	return "", errors.New("could not find newly added torrent id")
}

func (r Remote) Remove(id string) error {
	_, err := r.command("--torrent", id, "--remove-and-delete")
	return err
}

func (r Remote) Start(id string) error {
	_, err := r.command("--torrent", id, "--start")
	return err
}

func (r Remote) Stop(id string) error {
	_, err := r.command("--torrent", id, "--stop")
	return err
}

func (r Remote) List() ([]DownloadFile, error) {
	out, err := r.command("--list")
	if err != nil {
		r.log.Error("list comm")
		return nil, err
	}

	str := string(out)
	lines := strings.Split(str, "\n")[1:] // shift the header off
	dls := []DownloadFile{}

	for _, line := range lines {
		parts := multiSpaceRegex.Split(line, 10)
		parts = utils.DeleteEmpty(parts)

		// footer and empty lines, safely ignore
		if len(parts) < 5 {
			continue
		}

		if len(parts) != 9 {
			return nil, errors.New("found un-parsable line (" + strconv.Itoa(len(parts)) + ") '" + strings.Join(parts, ",") + "'")
		}

		realStatus := parts[7]
		simpleStatus := realStatus
		switch realStatus {
		case "Idle":
			simpleStatus = "downloading"
		case "Downloading":
			simpleStatus = "downloading"
		case "Stopped":
			simpleStatus = "paused"
		}

		dls = append(dls, DownloadFile{
			ID:               strings.Trim(strings.TrimSpace(parts[0]), "*"),
			DonePercent:      parts[1],
			AmountDownloaded: parts[2],
			ETA:              parts[3],
			UploadSpeed:      parts[4],
			DownloadSpeed:    parts[5],
			ShareRatio:       parts[6],
			Status:           parts[7],
			SimpleStatus:     simpleStatus,
			Name:             parts[8],
			log:              logger.Get("transmission.dl", colors.LoggerTransmissionDownloadColor),
		})
	}

	sort.Slice(dls, func(i, j int) bool {
		// TODO sort by "downloaded" first, then "downloading", then "idle", then "stopped"
		// 	second sort is "percentDone"
		//  third sort is "name"
		//  fourth sort is "id"
		return strings.Compare(dls[i].ID, dls[j].ID) == -1
	})

	return dls, nil
}

func (r Remote) MagnetLink(tID string) string {
	out, err := r.command("--torrent", tID, "--info")
	if err != nil {
		return ""
	}

	str := string(out)
	lines := strings.Split(str, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "  Magnet: ") {
			return strings.TrimPrefix(line, "  Magnet: ")
		}
	}

	return ""
}

func (r Remote) command(arg ...string) ([]byte, error) {
	r.log.Infof("command '%s'", strings.Join(arg, " "))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	args := append([]string{r.srvAddr}, arg...)
	out, err := exec.CommandContext(ctx, "transmission-remote", args...).Output()
	if err != nil {
		r.log.Err(err, "failed command 'transmission-remote %s'", strings.Join(args, " "))
	}

	return out, err
}

func downloadIds(downloads []DownloadFile) []string {
	ids := []string{}

	for _, v := range downloads {
		ids = append(ids, v.ID)
	}

	return ids
}
