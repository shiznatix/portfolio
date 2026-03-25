package vlc

import (
	"context"
	"errors"
	"os/exec"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"syscall"
	"time"
)

type process struct {
	ctx      context.Context
	cmd      *exec.Cmd
	log      logger.Logger
	password string
	running  bool
}

func (p *process) start() error {
	p.log.Info("starting")

	p.cmd = exec.Command("vlc", "--intf", "http", "--extraintf", "qt", "--http-password", p.password)
	p.cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	err := utils.ReadCommandPipes(p.cmd, func(line string) {
		p.log.Debug(line)
	})
	if err != nil {
		return err
	}

	if err := p.cmd.Start(); err != nil {
		return err
	}

	for i := 0; i < 5; i++ {
		cmd := "lsof -i -P -n | grep vlc"
		err := exec.Command("bash", "-c", cmd).Run()
		if err == nil {
			break
		}

		p.log.Infof("waiting for start %d", i)
		if !utils.CanceleableSleep(p.ctx, time.Second) {
			p.stop()
			return errors.New("context canceled while waiting to start")
		}
	}

	// give it a second to actually start
	if !utils.CanceleableSleep(p.ctx, time.Second) {
		p.stop()
		return errors.New("context canceled after starting")
	}

	p.log.Info("started")
	p.running = true

	go func() {
		if err := p.cmd.Wait(); err != nil {
			p.log.Err(err, "error waiting to finish")
		}

		p.cmd = nil
		p.running = false

		p.log.Info("finished")
	}()

	return nil
}

func (p *process) stop() error {
	p.log.Info("stopping")
	p.running = false

	if p.cmd == nil {
		return nil
	}

	return p.cmd.Process.Kill()
}
