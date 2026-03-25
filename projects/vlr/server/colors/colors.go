package colors

type Color string

const (
	Reset      Color = "\033[0m"
	Bold       Color = "\033[1m"
	Faint      Color = "\033[2m"
	Italics    Color = "\033[3m"
	Underlined Color = "\033[4m"

	Black       Color = "\033[30m"
	Red         Color = "\033[31m"
	Green       Color = "\033[32m"
	Yellow      Color = "\033[33m"
	Blue        Color = "\033[34m"
	Purple      Color = "\033[35m"
	Cyan        Color = "\033[36m"
	LightGray   Color = "\033[37m"
	Gray        Color = "\033[90m"
	LightRed    Color = "\033[91m"
	LightGreen  Color = "\033[92m"
	LightYellow Color = "\033[93m"
	LightBlue   Color = "\033[94m"
	LightPurple Color = "\033[95m"
	LightCyan   Color = "\033[96m"
	White       Color = "\033[97m"

	LevelUnknownColor Color = Italics
	LevelInfoColor    Color = Bold + Green
	LevelErrorColor   Color = Bold + Red
	LevelDebugColor   Color = Bold + Cyan

	LoggerMainColor                 Color = Underlined + Green
	LoggerControllersColor          Color = Underlined + Black
	LoggerFSEpsColor                Color = Underlined + Purple
	LoggerFSLabelsColor             Color = Underlined + LightPurple
	LoggerHDMICECColor              Color = Underlined + Yellow
	LoggerHDMICECConnectionColor    Color = LightYellow
	LoggerIMDBColor                 Color = Underlined + Blue
	LoggerIMDBCrawlerColor          Color = LightBlue
	LoggerMissingEpsColor           Color = Underlined + Cyan
	LoggerTorrents1337Color         Color = LightCyan
	LoggerSystemColor               Color = Underlined + LightGreen
	LoggerTransmissionColor         Color = Underlined + White
	LoggerTransmissionRemoteColor   Color = Gray
	LoggerTransmissionDownloadColor Color = LightGray
	LoggerVLCColor                  Color = Underlined + Red
	LoggerVLCProcessColor           Color = LightRed
	LoggerVLCScreensaverColor       Color = Italics + LightRed
)
