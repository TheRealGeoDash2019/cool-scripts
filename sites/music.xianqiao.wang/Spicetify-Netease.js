// Utils from Spicetify <3
class Utils {
  static addQueueListener(callback) {
    return callback;
  }

  static removeQueueListener(callback) {
    return true;
  }

  static convertIntToRGB(colorInt, div = 1) {
    const rgb = {
      r: Math.round(((colorInt >> 16) & 0xff) / div),
      g: Math.round(((colorInt >> 8) & 0xff) / div),
      b: Math.round((colorInt & 0xff) / div),
    };
    return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  }

  static normalize(s, emptySymbol = true) {
    const result = s
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/【/g, "[")
      .replace(/】/g, "]")
      .replace(/。/g, ". ")
      .replace(/；/g, "; ")
      .replace(/：/g, ": ")
      .replace(/？/g, "? ")
      .replace(/！/g, "! ")
      .replace(/、|，/g, ", ")
      .replace(/‘|’|′|＇/g, "'")
      .replace(/“|”/g, '"')
      .replace(/〜/g, "~")
      .replace(/·|・/g, "•");
    if (emptySymbol) {
        result.replace(/-/g, " ").replace(/\//g, " ");
    }
    return result.replace(/\s+/g, " ").trim();
  }

  static removeSongFeat(s) {
    return (
      s
        .replace(/-\s+(feat|with).*/i, "")
        .replace(/(\(|\[)(feat|with)\.?\s+.*(\)|\])$/i, "")
        .trim() || s
    );
  }

  static removeExtraInfo(s) {
    return s.replace(/\s-\s.*/, "");
  }

  static capitalize(s) {
    return s.replace(/^(\w)/, ($1) => $1.toUpperCase());
  }
}

const CosmosAsync = {
	get: async function(url, body, headers) {
		return await fetch(url, {
			method: "GET",
			headers,
			body
		}).then(res => {return res.json()
		}).then(json => { return json });
	},
	post: async function(url, body, headers) {
		return fetch(url, {
			method: "POST",
			headers,
			body
		}).then(res => {return res.json()
		}).then(json => { return json });
	}
}

// Netease Import

function Netease() {
	if (!new.target) {
		throw TypeError("Failed to construct 'Netease': Please use the 'new' operator, this constructor cannot be called as a function.");
	}
};

Netease.prototype.findLyrics = async function(info) {
	const requestHeader = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0",
  };
	const searchURL = `https://music.xianqiao.wang/neteaseapiv2/search?limit=10&type=1&keywords=`;
  const lyricURL = `https://music.xianqiao.wang/neteaseapiv2/lyric?id=`;
  
  const cleanTitle = Utils.removeExtraInfo(Utils.removeSongFeat(Utils.normalize(info.title)));
  const finalURL = searchURL + encodeURIComponent(`${cleanTitle} ${info.artist}`);
  
  const searchResults = await CosmosAsync.get(finalURL, null, requestHeader);
  
  const items = searchResults.result.songs;
  
  if (!items?.length) {
    throw "Cannot find track";
  }

  const album = Utils.capitalize(info.album);
  let itemId = items.findIndex((val) => Utils.capitalize(val.album.name) === album);
  if (itemId === -1) itemId = 0;

  return await CosmosAsync.get(lyricURL + items[itemId].id, null, requestHeader);
}

Netease.prototype.containCredits = function(text) {
	const creditInfo = [
    "\\s?作?\\s*词|\\s?作?\\s*曲|\\s?编\\s*曲?|\\s?监\\s*制?",
    ".*编写|.*和音|.*和声|.*合声|.*提琴|.*录|.*工程|.*工作室|.*设计|.*剪辑|.*制作|.*发行|.*出品|.*后期|.*混音|.*缩混",
    "原唱|翻唱|题字|文案|海报|古筝|二胡|钢琴|吉他|贝斯|笛子|鼓|弦乐",
    "lrc|publish|vocal|guitar|program|produce|write",
  ];
  const creditInfoRegExp = new RegExp(`^(${creditInfo.join("|")}).*(:|：)`, "i");
  
  return creditInfoRegExp.test(text);
}

Netease.prototype.parseTimestamp = function(line) {
	// ["[ar:Beyond]"]
  // ["[03:10]"]
  // ["[03:10]", "lyrics"]
  // ["lyrics"]
  // ["[03:10]", "[03:10]", "lyrics"]
  // ["[1235,300]", "lyrics"]
  const matchResult = line.match(/(\[.*?\])|([^\[\]]+)/g);
  if (!matchResult?.length || matchResult.length === 1) {
    return { text: line };
  }

  const textIndex = matchResult.findIndex((slice) => !slice.endsWith("]"));
  let text = "";

  if (textIndex > -1) {
    text = matchResult.splice(textIndex, 1)[0];
    text = Utils.capitalize(Utils.normalize(text, false));
  }

  const time = matchResult[0].replace("[", "").replace("]", "");

  return { time, text };
}

Netease.prototype.breakdownLine = function(text) {
  // (0,508)Don't(0,1) (0,151)want(0,1) (0,162)to(0,1) (0,100)be(0,1) (0,157)an(0,1)
  const components = text.split(/\(\d+,(\d+)\)/g);
  // ["", "508", "Don't", "1", " ", "151", "want" , "1" ...]
  const result = [];
  for (let i = 1; i < components.length; i += 2) {
    if (components[i + 1] === " ") continue;
    result.push({
      word: components[i + 1] + " ",
      time: parseInt(components[i]),
    });
  }
  return result;
}

Netease.prototype.getKaraoke = function(list) {
	const lyricStr = list?.klyric?.lyric;

  if (!lyricStr) {
  	return null;
  }

  const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
  const karaoke = lines
    .map((line) => {
      const { time, text } = this.parseTimestamp(line);
      if (!time || !text) return null;

      const [key, value] = time.split(",") || [];
      const [start, durr] = [parseFloat(key), parseFloat(value)];

      if (!isNaN(start) && !isNaN(durr) && !this.containCredits(text)) {
        return {
          startTime: start,
          // endTime: start + durr,
          text: this.breakdownLine(text),
        };
      }
      return null;
    })
    .filter((a) => a);

  if (!karaoke.length) {
    return null;
  }

  return karaoke;
}

Netease.prototype.getSynced = function(list) {
	const lyricStr = list?.lrc?.lyric;
  let isInstrumental = false;

  if (!lyricStr) {
    return null;
  }

  const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
  const lyrics = lines
    .map((line) => {
      const { time, text } = this.parseTimestamp(line);
      if (text === "纯音乐, 请欣赏") {
        isInstrumental = true;
      }
      if (!time || !text) return null;

      const [key, value] = time.split(":") || [];
      const [min, sec] = [parseFloat(key), parseFloat(value)];
      if (!isNaN(min) && !isNaN(sec) && !this.containCredits(text)) {
        return {
          startTime: (min * 60 + sec) * 1000,
          text: text || "",
        };
      }
      return null;
    })
    .filter((a) => a);

  if (!lyrics.length) {
    return null;
  }
  if (isInstrumental) {
    return [{ startTime: "0000", text: "♪ Instrumental ♪" }];
  }
  return lyrics;
}

Netease.prototype.getUnsynced = function(list) {
	const lyricStr = list?.lrc?.lyric;
  let isInstrumental = false;

  if (!lyricStr) {
    return null;
  }

  const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
  const lyrics = lines
	  .map((line) => {
	      const parsed = this.parseTimestamp(line);
	      if (parsed.text === "纯音乐, 请欣赏") {
	          isInstrumental = true;
	      }
	      if (!parsed.text || this.containCredits(parsed.text)) return null;
	      return parsed;
	  })
	  .filter((a) => a);

  if (!lyrics.length) {
    return null;
  }

  if (isInstrumental) {
    return [{ text: "♪ Instrumental ♪" }];
  }

  return lyrics;
}
