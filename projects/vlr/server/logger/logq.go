package logger

import (
	"container/list"
	"fmt"
	"shiznatix/vlr/utils"
	"strconv"
	"sync"
)

const maxHistoryLen = 100

type Queue struct {
	list  *list.List
	mutex *sync.Mutex
}

type storedMsgs struct {
	message  string
	lastTime string
	repeats  int
}

func NewQueue() Queue {
	return Queue{
		list:  list.New(),
		mutex: &sync.Mutex{},
	}
}

func (q Queue) Append(msg ...interface{}) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	newStr := fmt.Sprint(msg...)
	isRepeat := false
	lastMsg := q.list.Front()
	if lastMsg != nil {
		lastLogMsg := lastMsg.Value.(*storedMsgs)
		if lastLogMsg.message == newStr {
			lastLogMsg.repeats = lastLogMsg.repeats + 1
			isRepeat = true
		}
	}

	if !isRepeat {
		q.list.PushFront(&storedMsgs{
			message:  newStr,
			lastTime: utils.NowStr(),
			repeats:  0,
		})

		if q.list.Len() > maxHistoryLen {
			q.list.Remove(q.list.Back())
		}
	}
}

func (q Queue) Latest(c int, formatted bool) []string {
	lines := []string{}

	for e := q.list.Front(); e != nil; e = e.Next() {
		storedMsg := e.Value.(*storedMsgs)
		str := storedMsg.message

		if formatted {
			if storedMsg.repeats > 0 {
				str = storedMsg.lastTime + " (" + strconv.Itoa(storedMsg.repeats+1) + ") " + str
			} else {
				str = storedMsg.lastTime + " " + str
			}
		}

		lines = append(lines, str)
		if len(lines) >= c {
			break
		}
	}

	return lines
}
