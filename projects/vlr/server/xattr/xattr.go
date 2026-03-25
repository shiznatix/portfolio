package xattr

import (
	"errors"
	"os"
	"regexp"
	"shiznatix/vlr/utils"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/xattr"
)

const PlayedCount = "user.vlr.playedcount"
const LastPlayedTime = "user.vlr.lastplayedtime"
const AutoDownloaded = "user.vlr.autoDownloaded"
const SkipInRandom = "user.vlr.skipInRandom"
const Starred = "user.vlr.starred"
const Labels = "user.vlr.labels"

var LabelsStringRegeex = regexp.MustCompile(`^[a-zA-Z0-9\- :]{0,150}$`)

type VLRAttrs struct {
	PlayedCount    int      `json:"playedCount"`
	LastPlayedTime int64    `json:"lastPlayedTime"`
	AutoDownloaded bool     `json:"autoDownloaded"`
	SkipInRandom   bool     `json:"skipInRandom"`
	Starred        bool     `json:"starred"`
	Labels         []string `json:"labels"`
}

type File struct {
	filePath string
	isDir    bool
}

func New(filePath string) File {
	fileInfo, err := os.Stat(filePath)
	isDir := false
	if err == nil {
		isDir = fileInfo.IsDir()
	}

	return File{
		filePath: filePath,
		isDir:    isDir,
	}
}

func (f File) setInt(attr string, val int) error {
	return xattr.Set(f.filePath, attr, []byte(strconv.Itoa(val)))
}

func (f File) setInt64(attr string, val int64) error {
	return xattr.Set(f.filePath, attr, []byte(strconv.FormatInt(val, 10)))
}

func (f File) setBool(attr string, val bool) error {
	str := "0"
	if val {
		str = "1"
	}

	return xattr.Set(f.filePath, attr, []byte(str))
}

func (f File) string(attr string) string {
	if data, err := xattr.Get(f.filePath, attr); err == nil {
		return string(data)
	}

	return ""
}

func (f File) int(attr string) int {
	return utils.StrToInt(f.string(attr))
}

func (f File) int64(attr string) int64 {
	return utils.StrToInt64(f.string(attr))
}

func (f File) bool(attr string) bool {
	return f.string(attr) == "1"
}

func (f File) VLRAttrs() VLRAttrs {
	attrs := VLRAttrs{
		Labels:  f.Labels(),
		Starred: f.bool(Starred),
	}

	if !f.isDir {
		attrs.PlayedCount = f.int(PlayedCount)
		attrs.LastPlayedTime = f.int64(LastPlayedTime)
		attrs.AutoDownloaded = f.bool(AutoDownloaded)
		attrs.SkipInRandom = f.bool(SkipInRandom)
	}

	return attrs
}

func (f File) Labels() []string {
	return utils.DeleteEmpty(strings.Split(f.string(Labels), ":"))
}

func (f File) SetPlayed() error {
	if f.isDir {
		return errors.New("directories cannot set played attribute")
	}

	pCount := f.int(PlayedCount)

	var res error

	if err := f.SetLastPlayedTime(time.Now().Unix()); err != nil {
		res = err
	}
	if err := f.SetPlayedCount((pCount + 1)); err != nil {
		res = err
	}
	if err := f.SetSkipInRandom(false); err != nil {
		res = err
	}

	return res
}

func (f File) SetLastPlayedTime(val int64) error {
	if f.isDir {
		return errors.New("directories cannot set last-played-time attribute")
	}

	return f.setInt64(LastPlayedTime, val)
}

func (f File) SetPlayedCount(val int) error {
	if f.isDir {
		return errors.New("directories cannot set played-count attribute")
	}

	return f.setInt(PlayedCount, val)
}

func (f File) SetAutoDownloaded(val bool) error {
	if f.isDir {
		return errors.New("directories cannot set auto-downloaded attribute")
	}

	return f.setBool(AutoDownloaded, val)
}

func (f File) SetNewDownload() error {
	if f.isDir {
		return errors.New("directories cannot set new downloaded attributes")
	}

	var res error

	if err := f.SetAutoDownloaded(true); err != nil {
		res = err
	}
	if err := f.SetSkipInRandom(true); err != nil {
		res = err
	}

	return res
}

func (f File) SetSkipInRandom(val bool) error {
	if f.isDir {
		return errors.New("directories cannot set skip-in-random attribute")
	}

	return f.setBool(SkipInRandom, val)
}

func (f File) SetStarred(val bool) error {
	return f.setBool(Starred, val)
}

func (f File) SetLabels(labels string) error {
	return xattr.Set(f.filePath, Labels, []byte(labels))
}
