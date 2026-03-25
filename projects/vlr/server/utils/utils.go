package utils

import (
	"bytes"
	"context"
	"errors"
	"io"
	"io/fs"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var digitCheck = regexp.MustCompile("^[0-9]+$")

var playableExts = []string{
	".mkv",
	".mpg",
	".mpeg",
	".avi",
	".mp4",
	".mpv",
	".wmv",
	".ogg",
	".ogv",
	".ogm",
	".ts",
}

var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

type ConvertibleBool bool

func (b *ConvertibleBool) UnmarshalJSON(data []byte) error {
	asString := string(data)
	if asString == "1" || asString == "true" {
		*b = true
	} else if asString == "0" || asString == "false" {
		*b = false
	} else {
		return errors.New("boolean unmarshal error: invalid input " + asString)
	}
	return nil
}

func RecoverPanicWithLogging(log logger) {
	if p := recover(); p != nil {
		var err error

		switch x := p.(type) {
		case string:
			err = errors.New(x)
		case error:
			err = x
		default:
			err = errors.New("unknown panic")
		}

		log.Err(err, "recovered panic")
	}
}

func HTTPGet(url string, timeout time.Duration) ([]byte, error) {
	client := http.Client{
		Timeout: timeout,
	}
	res, err := client.Get(url)
	if err != nil {
		return []byte{}, err
	}

	defer res.Body.Close()

	if res.StatusCode == http.StatusOK {
		b, err := io.ReadAll(res.Body)
		if err != nil {
			return []byte{}, err
		}

		return b, nil
	}

	return []byte{}, errors.New("not-ok status code returned '" + strconv.Itoa(res.StatusCode) + "'")
}

func HTTPPost(url string, json []byte, timeout time.Duration) ([]byte, error) {
	client := http.Client{
		Timeout: timeout,
	}
	res, err := client.Post(url, "application/json", bytes.NewReader(json))
	if err != nil {
		return []byte{}, err
	}

	defer res.Body.Close()

	if res.StatusCode == http.StatusOK {
		b, err := io.ReadAll(res.Body)
		if err != nil {
			return []byte{}, err
		}

		return b, nil
	}

	return []byte{}, errors.New("not-ok status code returned '" + strconv.Itoa(res.StatusCode) + "'")
}

func StrToInt(str string) int {
	val, err := strconv.Atoi(str)
	if err != nil {
		return 0
	}

	return val
}

func StrToInt64(str string) int64 {
	val, err := strconv.ParseInt(str, 0, 64)
	if err != nil {
		return 0
	}

	return val
}

func NowStr() string {
	return time.Now().Format("Jan 02 15:04:05")
}

func MonthAbbrToNum(m string) string {
	switch strings.ToLower(m) {
	case "jan":
		return "01"
	case "feb":
		return "02"
	case "mar":
		return "03"
	case "apr":
		return "04"
	case "may":
		return "05"
	case "jun":
		return "06"
	case "jul":
		return "07"
	case "aug":
		return "08"
	case "sep":
		return "09"
	case "oct":
		return "10"
	case "nov":
		return "11"
	case "dec":
		return "12"
	}

	return "01"
}

func ElapsedDaysFloat(ts int64) float64 {
	days := time.Since(time.Unix(ts, 0)).Hours() / 24
	return math.Round(days*10) / 10 // 1 decimal place
}

func ContainsStr(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func DeleteEmpty(s []string) []string {
	var r []string

	for _, str := range s {
		if str != "" {
			r = append(r, str)
		}
	}

	return r
}

func Reverse(s []string) {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
}

func IsPlayableExtension(fileName string) bool {
	fileExt := filepath.Ext(fileName)

	for _, ext := range playableExts {
		if fileExt == ext {
			return true
		}
	}

	return false
}

func OnlyDigits(str string) bool {
	return digitCheck.MatchString(str)
}

func PrefixZero(num string) string {
	if len(num) == 1 {
		return "0" + num
	}

	return num
}

func RandString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}

func IsCanceled(ctx context.Context) bool {
	err := ctx.Err()
	if err == nil {
		return false
	}

	return errors.Is(err, context.Canceled)
}

func CopyFile(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}

	if info.IsDir() {
		if err := os.Mkdir(dst, os.ModePerm); err != nil {
			return err
		}

		return filepath.WalkDir(src, func(path string, d fs.DirEntry, e error) error {
			if path == src {
				return nil
			}

			return CopyFile(path, dst+"/"+d.Name())
		})
	}

	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return out.Close()
}

func EnsureDir(path string) error {
	info, err := os.Stat(path)
	if err == nil {
		if info.IsDir() {
			return nil
		}

		return errors.New("path exists but is a regular file")
	}

	return os.Mkdir(path, os.ModePerm)
}

func GetShowDir(showDirs []string, showName string) string {
	for _, dir := range showDirs {
		findDir := dir + "/" + showName
		destInfo, err := os.Stat(findDir)
		if err == nil && destInfo.IsDir() {
			return findDir
		}
	}

	return showDirs[0] + "/" + showName
}

func Unique[T comparable](s []T) []T {
	var u []T

	for _, e := range s {
		if !Contains(u, e) {
			u = append(u, e)
		}
	}

	return u
}

func Contains[T comparable](s []T, e T) bool {
	for _, v := range s {
		if v == e {
			return true
		}
	}
	return false
}

func FilterByValue[T comparable](all []T, possible []T) []T {
	vals := []T{}

	for _, v := range all {
		if Contains(possible, v) {
			vals = append(vals, v)
		}
	}

	return vals
}

func CanceleableSleep(ctx context.Context, d time.Duration) bool {
	ticker := time.NewTicker(d)
	for {
		select {
		case <-ctx.Done():
			ticker.Stop()
			return false
		case <-ticker.C:
			return true
		}
	}
}
