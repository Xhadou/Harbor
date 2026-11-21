/**
 * What Settings search knows about meaning.
 *
 * The index matches words. These two tables let a search be put in other
 * words than the ones a setting happens to use, without every entry listing
 * every wording: "captions" finds Subtitles, "erase" finds Clear caches,
 * "dark mode" finds the theme.
 *
 * It is a word list, not a language model: it runs on the Mac, instantly and
 * offline, and it only knows the ideas written here.
 */

/**
 * Words that stand for the same idea, one idea per line. A word of the search
 * also matches an entry carrying another word of its line. Whole words only,
 * and a line is not chained to another that shares a word with it.
 */
export const SEARCH_CONCEPTS: readonly (readonly string[])[] = [
  // Picture and sound
  ["subtitle", "subtitles", "caption", "captions", "subs"],
  ["sound", "audio", "volume"],
  ["quiet", "loud", "louder", "loudness", "boost", "normalize", "normalise"],
  ["mute", "muted", "silent", "silence"],
  ["quality", "resolution", "definition"],
  ["4k", "uhd", "2160p"],
  ["brightness", "bright", "brighter"],
  ["dub", "dubs", "dubbed"],
  [
    "lag",
    "laggy",
    "stutter",
    "stutters",
    "stuttering",
    "choppy",
    "jerky",
    "buffering",
    "buffer",
    "stall",
    "stalled",
    "freeze",
    "freezes",
    "freezing",
    "slow",
  ],
  // Playback
  ["autoplay", "auto", "automatic", "automatically"],
  ["intro", "intros", "opening", "openings"],
  ["outro", "outros", "credits", "ending", "endings"],
  ["cast", "casting", "chromecast", "airplay"],
  // Look
  ["theme", "themes", "appearance", "skin", "look"],
  ["dark", "black", "dim", "oled"],
  ["color", "colors", "colour", "colours"],
  ["font", "fonts", "typeface", "typography", "text"],
  ["bigger", "larger", "enlarge", "increase"],
  ["smaller", "shrink", "reduce", "decrease"],
  ["scale", "zoom", "magnify"],
  ["customize", "customise", "personalize", "personalise", "custom"],
  ["favorite", "favorites", "favourite", "favourites"],
  ["mouse", "cursor", "pointer"],
  ["screensaver", "idle", "sleep"],
  // Words and language
  ["language", "languages", "locale"],
  ["translate", "translation", "translations", "localization", "localisation"],
  ["app", "application", "interface", "ui", "harbor"],
  // Input
  [
    "keyboard",
    "hotkey",
    "hotkeys",
    "shortcut",
    "shortcuts",
    "keybind",
    "keybinds",
    "keybinding",
    "keybindings",
  ],
  ["controller", "controllers", "gamepad", "gamepads", "joystick", "joypad"],
  ["tv", "television", "couch"],
  // Account and privacy
  ["login", "logon", "signin"],
  ["password", "passcode", "pin"],
  ["kids", "kid", "child", "children", "parental", "family"],
  ["privacy", "private", "telemetry", "analytics"],
  ["spoiler", "spoilers", "blur", "censor"],
  ["adult", "nsfw", "mature", "explicit"],
  ["ads", "adverts", "advertising", "commercials"],
  // Data and upkeep
  ["delete", "erase", "wipe", "remove", "clear", "purge"],
  ["reset", "revert", "default", "defaults"],
  ["cache", "caches", "storage", "disk", "space", "data"],
  ["backup", "backups", "export"],
  ["restore", "import"],
  ["update", "updates", "upgrade", "version"],
  ["sync", "synchronize", "synchronise", "syncing"],
  ["download", "downloads", "offline"],
  ["startup", "launch", "boot", "autostart"],
  ["notification", "notifications", "notify", "alert", "alerts"],
  // Sources and network
  ["torrent", "torrents", "p2p", "peer", "peers", "magnet"],
  ["addon", "addons", "extension", "extensions"],
  ["network", "internet", "wifi", "bandwidth", "connection", "online"],
  // Help
  [
    "bug",
    "bugs",
    "issue",
    "issues",
    "problem",
    "problems",
    "crash",
    "crashes",
    "error",
    "errors",
    "broken",
  ],
  ["help", "support", "feedback"],
  ["license", "licenses", "licence", "licences"],
];

/**
 * Wordings of more than one word, rewritten to the words the index uses
 * before the search is split up. Longest first where one contains another.
 */
export const SEARCH_PHRASES: readonly (readonly [string, string])[] = [
  ["closed captions", "subtitles"],
  ["closed caption", "subtitles"],
  // As a word of its own; inside "account" it is only two letters.
  ["cc", "subtitles"],
  ["dark mode", "dark theme"],
  ["light mode", "light theme"],
  ["log in", "sign in"],
  ["log on", "sign in"],
  ["log out", "sign out"],
  ["log off", "sign out"],
  ["logout", "sign out"],
  ["full screen", "fullscreen"],
  ["mobile data", "bandwidth"],
  ["data usage", "bandwidth"],
  ["key bindings", "keybindings"],
  ["key binding", "keybinding"],
  ["auto play", "autoplay"],
  ["start up", "startup"],
  ["set up", "setup"],
];

/**
 * Words that say what kind of thing is wanted, not which one ("kids mode",
 * "volume setting"). They help when an entry carries them and are not held
 * against one that does not, as long as the search has another word to go on.
 */
export const SEARCH_WEAK_WORDS: readonly string[] = [
  "mode",
  "modes",
  "setting",
  "settings",
  "option",
  "options",
  "feature",
  "features",
  "preference",
  "preferences",
];
