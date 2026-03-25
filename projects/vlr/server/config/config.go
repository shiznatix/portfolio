package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

var Config *config = &config{
	InstallPath:    "/var/lib/vlr",
	ClientPath:     "/var/lib/vlr/client",
	CachePath:      "/var/lib/vlr/cache",
	MediaDriveDirs: []string{},
	ShowDirs:       []string{},
	LabelDirs:      []string{},
	IMDBMap:        map[string]string{},
	ShowCategories: map[string][]string{},
}

type favicoColors struct {
	Icon       string
	Background string
}

type config struct {
	Name                          string              `json:"name"`
	InstallPath                   string              `json:"-"`
	ClientPath                    string              `json:"-"`
	CachePath                     string              `json:"-"`
	VLRSearchURL                  string              `json:"vlrSearchUrl,omitempty"`
	MasterServer                  string              `json:"masterServer,omitempty"`
	Port                          string              `json:"-"`
	CecTvAddress                  string              `json:"cecTvAddress,omitempty"`
	TransmissionLocation          string              `json:"-"`
	DownloadsDir                  string              `json:"-"`
	OrphansDir                    string              `json:"-"`
	MediaDriveDirs                []string            `json:"mediaDriveDirs,omitempty"`
	ShowDirs                      []string            `json:"showDirs,omitempty"`
	LabelDirs                     []string            `json:"labelDirs,omitempty"`
	DefaultVolumeControl          string              `json:"defaultVolumeControl"`
	VolumeControls                []string            `json:"volumeControls,omitempty"`
	IMDBMap                       map[string]string   `json:"-"`
	ShowCategories                map[string][]string `json:"-"`
	ClientFavicoColors            favicoColors        `json:"-"`
	ClientThemeName               string              `json:"themeName,omitempty"`
	DBSyncMissingEpsDefaultStatus string              `json:"dbSyncMissingEpsDefaultStatus,omitempty"`
	ScreensaverURL                string              `json:"screensaverUrl,omitempty"`
}

func init() {
	if err := godotenv.Load(Config.InstallPath + "/.env"); err != nil {
		panic(err)
	}

	loadJSON(Config.InstallPath+"/imdb.json", &Config.IMDBMap)
	loadJSON(Config.InstallPath+"/shows.json", &Config.ShowCategories)

	// now we should have all env vars set
	Config.Name = os.Getenv("NAME")
	Config.MasterServer = os.Getenv("MASTER_SERVER")
	Config.VLRSearchURL = os.Getenv("VLR_SEARCH_URL")
	Config.CecTvAddress = os.Getenv("CEC_TV_ADDRESS")
	Config.TransmissionLocation = os.Getenv("TRANSMISSION_LOCATION")
	Config.DownloadsDir = os.Getenv("DOWNLOADS_DIR")
	Config.OrphansDir = os.Getenv("ORPHANS_DIR")
	Config.MediaDriveDirs = strings.Split(os.Getenv("MEDIA_DRIVE_PATHS"), ":")
	Config.ShowDirs = strings.Split(os.Getenv("SHOW_PATHS"), ":")
	Config.LabelDirs = strings.Split(os.Getenv("LABEL_PATHS"), ":")
	Config.DefaultVolumeControl = os.Getenv("DEFAULT_VOLUME_CONTROL")
	Config.VolumeControls = strings.Split(os.Getenv("VOLUME_CONTROLS"), ":")
	Config.Port = os.Getenv("PORT")
	Config.ClientFavicoColors = favicoColors{
		Icon:       os.Getenv("CLIENT_FAVICO_COLOR"),
		Background: os.Getenv("CLIENT_FAVICO_BACKGROUND_COLOR"),
	}
	Config.ClientThemeName = os.Getenv("CLIENT_THEME_NAME")
	Config.DBSyncMissingEpsDefaultStatus = os.Getenv("DB_SYNC_MISSING_EPS_DEFAULT_STATUS")
	Config.ScreensaverURL = os.Getenv("SCREENSAVER_URL")

	if Config.Port == "" {
		Config.Port = "80"
	}
}

func (c config) Print() {
	fmt.Println("| Name:", c.Name)
	fmt.Println("| InstallPath:", c.InstallPath)
	fmt.Println("| ClientPath:", c.ClientPath)
	fmt.Println("| CachePath:", c.CachePath)
	fmt.Println("| MasterServer:", c.MasterServer)
	fmt.Println("| Port:", c.Port)
	fmt.Println("| ClientThemeName:", c.ClientThemeName)
	fmt.Println("| CecTvAddress:", c.CecTvAddress)
	fmt.Println("| VLRSearchURL:", c.VLRSearchURL)
	fmt.Println("| ClientFavicoColors:", c.ClientFavicoColors)
	fmt.Println("| DBSyncMissingEpsDefaultStatus:", c.DBSyncMissingEpsDefaultStatus)
	fmt.Println("| TransmissionLocation:", c.TransmissionLocation)
	fmt.Println("| DownloadsDir:", c.DownloadsDir)
	fmt.Println("| OrphansDir:", c.OrphansDir)
	fmt.Println("| MediaDriveDirs:", c.MediaDriveDirs)
	fmt.Println("| ShowDirs:", c.ShowDirs)
	fmt.Println("| LabelDirs:", c.LabelDirs)
	fmt.Println("| DefaultVolumeControl:", c.DefaultVolumeControl)
	fmt.Println("| VolumeControls:", c.VolumeControls)
	fmt.Println("| ScreensaverURL:", c.ScreensaverURL)
	fmt.Printf("| IMDBMap: len(%d)\n", len(c.IMDBMap))
	fmt.Printf("| ShowCategories: len(%d)\n", len(c.ShowCategories))
}

func loadJSON(fPath string, i interface{}) error {
	b, err := os.ReadFile(fPath)
	if err != nil {
		return err
	} else if err := json.Unmarshal(b, i); err != nil {
		return err
	}

	return nil
}
