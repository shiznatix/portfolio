package imdbeps

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

var epNumRegex = regexp.MustCompile("S[0-9]{1,2}.E([0-9]{1,2}) ∙ (.*)$")

type crawler struct {
	show
	ctx      context.Context
	episodes []Episode
	log      logger.Logger
}

func newCrawler(ctx context.Context, show show) crawler {
	return crawler{
		show:     show,
		ctx:      ctx,
		episodes: []Episode{},
		log:      logger.Get("imdb.crawler", colors.LoggerIMDBCrawlerColor),
	}
}

func (c *crawler) crawl() error {
	var err error
	nextSeason := "1"
	for {
		nextSeason, err = c.season(nextSeason)
		if err != nil {
			return err
		}
		if nextSeason == "" {
			break
		}
	}

	return nil
}

func (c *crawler) season(seasonName string) (string, error) {
	if utils.IsCanceled(c.ctx) {
		return "", errors.New("context was canceled")
	}

	url := "https://www.imdb.com/title/" + c.ImdbID + "/episodes?season=" + seasonName

	c.log.Info("fetching show:'" + c.Name + "' (" + c.ImdbID + ") episodes for season:" + seasonName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/117.0")

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}

	defer res.Body.Close()

	doc, err := goquery.NewDocumentFromReader(res.Body)
	if err != nil {
		return "", err
	}

	seasonEpsCount := 0
	doc.Find("h4").Each(func(i int, sel *goquery.Selection) {
		airDate := strings.TrimSpace(sel.Parent().Find(("span")).Text())
		if airDate == "" {
			c.log.Debug("airdate was empty, probably not aired yet")
			return
		}

		airTime, err := c.parseAirDate(airDate)
		if err != nil {
			c.log.Err(err, "failed parsing air time show:'%s' season:'%s'", c.Name, seasonName)
			return
		}

		epStr := sel.Find("a").Text()
		// TODO - we should allow for unknown seasons and non-standard names???
		match := epNumRegex.FindStringSubmatch(epStr)
		if len(match) != 3 {
			c.log.Errorf("failed finding and parsing episode string show:'%s' season:%s imdbName:'%s'", c.Name, seasonName, epStr)
			return
		}

		epNum := strings.TrimSpace(match[1])
		epName := strings.TrimSpace(match[2])

		baseEp := utils.Episode{
			ShowName:      c.Name,
			SeasonName:    seasonName,
			EpisodeNumber: epNum,
			EpisodeName:   epName,
		}
		ep := newEpisode(c.ID, baseEp, airTime)
		c.episodes = append(c.episodes, ep)
		seasonEpsCount++
	})

	c.log.Infof("found %d episodes for show:'%s' season:'%s' total:'%d'", seasonEpsCount, c.Name, seasonName, len(c.episodes))

	nextSeason := ""
	foundState := 0
	doc.Find(`[data-testid="tab-season-entry"]`).EachWithBreak(func(i int, sel *goquery.Selection) bool {
		sName := strings.TrimSpace(sel.Text())
		if sName == seasonName {
			foundState = 1
			return true
		}
		if foundState == 1 {
			nextSeason = sName
			return false
		}
		return true
	})

	return nextSeason, nil
}

func (c crawler) parseAirDate(d string) (int64, error) {
	if d == "" {
		return 0, errors.New("date was empty")
	}

	// first convert to YYYY-MM-DD
	parts := strings.Split(d, " ")
	if len(parts) < 4 {
		return 0, errors.New("date parts length less than 4")
	}

	day := utils.PrefixZero(strings.Replace(parts[2], ",", "", 1))
	monAbbrv := parts[1]
	year := parts[3]
	d = year + "-" + utils.MonthAbbrToNum(monAbbrv) + "-" + day

	// make it last second of the day, UTC
	d = d + "T23:59:59Z"
	t, err := time.Parse(time.RFC3339, d)
	if err != nil {
		return 0, err
	}

	return t.Unix(), nil
}
