package hdmicec

import (
	"context"
	"errors"
	"io"
	"os/exec"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"strings"
	"sync"
	"time"
)

type connection struct {
	ctx       context.Context
	mutex     *sync.Mutex
	log       logger.Logger
	rawLog    logger.Queue
	connected bool
	cmd       *exec.Cmd
	cmdIn     io.WriteCloser
}

func (conn *connection) disconnect() error {
	conn.mutex.Lock()
	defer conn.mutex.Unlock()

	conn.log.Info("disconnecting")
	var err error

	if conn.cmd != nil {
		conn.log.Info("sending quit signal")
		conn.cmdIn.Write([]byte("q"))
		utils.CanceleableSleep(conn.ctx, time.Second*2)

		conn.log.Info("killing process")
		err = conn.cmd.Process.Kill()
	}

	conn.log.Info("resetting variables")
	conn.cmd = nil
	conn.connected = false
	conn.cmdIn = nil

	return err
}

func (conn *connection) connect() error {
	conn.mutex.Lock()
	defer conn.mutex.Unlock()

	if conn.cmd != nil {
		if err := conn.disconnect(); err != nil {
			conn.log.Err(err, "failed disconnecting from cec")
		}
	}

	// conn.cmd = exec.Command("cec-client", "RPI", "-d", "1")
	conn.cmd = exec.Command("cec-client", "-d", "1")

	err := utils.ReadCommandPipe(conn.cmd.StdoutPipe, func(line string) {
		conn.rawLog.Append(line)
		conn.log.Infof("received '%s'", line)

		if strings.Contains(line, "waiting for input") {
			conn.connected = true
		}
	})
	if err != nil {
		return err
	}

	stdin, err := conn.cmd.StdinPipe()
	if err != nil {
		return err
	}

	conn.cmdIn = stdin

	if err := conn.cmd.Start(); err != nil {
		return err
	}

	for i := 0; i < 10; i++ {
		if conn.connected {
			break
		}

		conn.log.Infof("waiting for cec connection to start %d", i)
		utils.CanceleableSleep(conn.ctx, time.Second)
	}

	go func() {
		if err := conn.cmd.Wait(); err != nil {
			conn.log.Err(err, "failed waiting for cec connection to finish")
		}

		conn.log.Info("cec connection process finished")

		conn.cmd = nil
		conn.disconnect()
	}()

	if !conn.connected {
		if err := conn.disconnect(); err != nil {
			return err
		}

		return err
	}

	conn.log.Info("cec connection established")
	return nil
}

func (conn connection) readyForInput() bool {
	return conn.cmd != nil && conn.connected
}

func (conn *connection) write(cmd string) error {
	if !conn.readyForInput() {
		return errors.New("cec connection not ready")
	}

	conn.mutex.Lock()
	defer conn.mutex.Unlock()

	conn.log.Info("sending command: '" + cmd + "'")

	_, err := conn.cmdIn.Write([]byte(cmd + "\n"))

	return err
}

func (conn connection) getLogLine(search string) string {
	for i := 0; i < 5; i++ {
		msgs := conn.rawLog.Latest(20, false)
		for _, l := range msgs {
			if strings.Contains(l, search) {
				return strings.Replace(l, search, "", 1)
			}
		}

		utils.CanceleableSleep(conn.ctx, time.Second)
	}

	return ""
}
