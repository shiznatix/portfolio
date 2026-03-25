package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"os/signal"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/config"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/fslabels"
	"shiznatix/vlr/hdmicec"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/systm"
	"shiznatix/vlr/transmission"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/vlc"
	"strings"
	"time"

	_ "github.com/joho/godotenv/autoload"
)

var log = logger.Get("main", colors.LoggerMainColor)

func createAppIcon() error {
	var tmpPath = "/tmp/vlr-icon-colored.svg"

	indexBts, err := os.ReadFile(config.Config.ClientPath + "/icon.svg")
	if err != nil {
		return errors.New("failed to read icon.svg " + err.Error())
	}

	index := string(indexBts)
	index = strings.ReplaceAll(index, "white", config.Config.ClientFavicoColors.Icon)
	// TODO use the `config.Config.ClientFavicoColors.Background` too!
	b := []byte(index)
	if err := os.WriteFile(tmpPath, b, 0644); err != nil {
		exec.Command("cp", config.Config.ClientPath+"/icon-default.png", config.Config.ClientPath+"/icon.png")
		return errors.New("failed to replace svg color string " + err.Error())
	}

	cmdConv := exec.Command("convert", "-density", "1200", "-resize", "96x96", tmpPath, config.Config.ClientPath+"/icon.png")
	if err := cmdConv.Run(); err != nil {
		exec.Command("cp", config.Config.ClientPath+"/icon-default.png", config.Config.ClientPath+"/icon.png")
		return errors.New("failed to convert svg to png " + err.Error())
	}

	cmdRm := exec.Command("rm", tmpPath)
	if err := cmdRm.Run(); err != nil {
		return errors.New("failed to remove temp file " + err.Error())
	}

	return nil
}

func createIndexHtml() error {
	tmplB, err := os.ReadFile(config.Config.ClientPath + "/index.tmpl.html")
	if err != nil {
		return err
	}

	confB, err := json.MarshalIndent(config.Config, "", "  ")
	if err != nil {
		return err
	}

	index := string(tmplB)
	index = strings.ReplaceAll(index, "%CONFIG%", string(confB))
	index = strings.ReplaceAll(index, "%NAME%", config.Config.Name)

	if err := os.WriteFile(config.Config.ClientPath+"/index.html", []byte(index), 0644); err != nil {
		return err
	}

	return nil
}

func createManifestJson() error {
	tmplB, err := os.ReadFile(config.Config.ClientPath + "/manifest.tmpl.json")
	if err != nil {
		return err
	}

	index := string(tmplB)
	index = strings.ReplaceAll(index, "%NAME%", config.Config.Name)

	if err := os.WriteFile(config.Config.ClientPath+"/manifest.json", []byte(index), 0644); err != nil {
		return err
	}

	return nil
}

func main() {
	log.Info("starting vlr with config")
	config.Config.Print()

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		sig := <-c
		log.Infof("system call %s", sig)
		cancel()
	}()

	if err := createIndexHtml(); err != nil {
		log.Err(err, "Failed to create index.html")
		panic(err)
	}
	if err := createManifestJson(); err != nil {
		log.Err(err, "Failed to create manifest.json")
		panic(err)
	}
	if err := createAppIcon(); err != nil {
		log.Err(err, "Failed to convert svg icon to png")
	}

	masterServer := utils.NewMasterServer(config.Config.MasterServer)
	fsdb := fseps.New(fseps.Config{
		Ctx:           ctx,
		CacheFilePath: config.Config.CachePath + "/fseps.json",
		ShowDirs:      config.Config.ShowDirs,
	})
	fslabels := fslabels.New(fslabels.Config{
		Ctx:           ctx,
		CacheFilePath: config.Config.CachePath + "/fslabels.json",
		Dirs:          config.Config.LabelDirs,
	})
	v := vlc.New(vlc.Config{
		Ctx:            ctx,
		IP:             "127.0.0.1",
		Port:           8080,
		Password:       utils.RandString(8),
		ScreensaverURL: config.Config.ScreensaverURL,
	})
	imdb := imdbeps.New(imdbeps.Config{
		Ctx:           ctx,
		CacheFilePath: config.Config.CachePath + "/imdb.json",
		ShowIDMap:     config.Config.IMDBMap,
		MasterServer:  masterServer,
	})
	meps := missingeps.New(missingeps.Config{
		Ctx:               ctx,
		CacheFilePath:     config.Config.CachePath + "/missingeps.json",
		VLRSearchURL:      config.Config.VLRSearchURL,
		FSEps:             fsdb,
		IMDBEps:           imdb,
		MasterServer:      masterServer,
		DefaultSyncStatus: config.Config.DBSyncMissingEpsDefaultStatus,
	})
	trnsmRmt := transmission.New(transmission.Config{
		Ctx:          ctx,
		Remote:       transmission.NewRemote(config.Config.TransmissionLocation),
		FSEps:        fsdb,
		MissingEps:   meps,
		MasterServer: masterServer,
	})
	hc := hdmicec.New(hdmicec.Config{
		Ctx:       ctx,
		TVAddress: config.Config.CecTvAddress,
	})
	sys := systm.New(systm.Config{
		Ctx:    ctx,
		Cancel: cancel,
	})

	// serve HTTP
	srv := server{
		ctx:          ctx,
		cancel:       cancel,
		vlc:          v,
		fseps:        fsdb,
		fslabels:     fslabels,
		missingeps:   meps,
		imdbeps:      imdb,
		transmission: trnsmRmt,
		hdmicec:      hc,
		systm:        sys,
		masterServer: masterServer,
	}
	if err := srv.serve(); err != nil {
		log.Err(err, "failed to serve")
	}

	// kill it all, we are done
	ctx, cancel = context.WithTimeout(context.Background(), 2*time.Second)
	go func() {
		v.Close()
		cancel()
	}()
	<-ctx.Done()
}
