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

globalThis.sendCosmosRequest = function(config) {
    let requestOptions = JSON.parse(config.request);
    if (!requestOptions) throw new Error("Expected Request params");

    fetch(requestOptions.uri, requestOptions).then(res => {
        return res.text();
    }).then(text => {
        if (config.onSuccess) {
            config.onSuccess(JSON.stringify({
		body: text
	    }));
        }
    }).catch(err => {
        if (config.onFailure) {
            config.onFailure(err);
        } else {
            throw err;
        }
    })
}

// Netease Import

function Genius() {
	if (!new.target) {
		throw TypeError("Failed to construct 'Genius': Please use the 'new' operator, this constructor cannot be called as a function.");
	}
};

Genius.prototype.getChildDeep = function(parent, isDeep = false) {
    let acc = "";

    if (!parent.children) {
        return acc;
    }

    for (const child of parent.children) {
        if (typeof child == "string") {
            acc += child;
        } else if (child.children) {
            acc += this.getChildDeep(child, true);
        }
        if (!isDeep) {
            acc += "\n";
        }
    }
    return acc.trim();
}

Genius.prototype.getNote = async function(id) {
    const body = await CosmosAsync.get(`https://genius.com/api/annotations/${id}`);
    const response = body.response;
    let note = "";

    // Authors annotations
    if (response.referent && response.referent.classification == "verified") {
        const referentsBody = await CosmosAsync.get(`https://genius.com/api/referents/${id}`);
        const referents = referentsBody.response;
        for (const ref of referents.referent.annotations) {
            note += this.getChildDeep(ref.body.dom);
        }
    }

    // Users annotations
    if (!note && response.annotation) {
        note = this.getChildDeep(response.annotation.body.dom);
    }

    // Users comments
    if (!note && response.annotation && response.annotation.top_comment) {
        note += this.getChildDeep(response.annotation.top_comment.body.dom);
    }
    note = note.replace(/\n\n\n?/, "\n");

    return note;
}

Genius.prototype.fetchHTML = function(url) {
    return new Promise((resolve, reject) => {
        const request = JSON.stringify({
            method: "GET",
            uri: url,
        });

        globalThis.sendCosmosRequest({
            request,
            persistent: false,
            onSuccess: resolve,
            onFailure: reject,
        });
    });
}

Genius.prototype.fetchLyricsVersion = async function(results, index) {
    const result = results[index];
    if (!result) {
        console.warn(result);
        return;
    }

    const site = await this.fetchHTML(result.url);
    const body = JSON.parse(site)?.body;
    if (!body) {
        return null;
    }

    let lyrics = "";
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(body, "text/html");
    const lyricsDiv = htmlDoc.querySelectorAll('div[data-lyrics-container="true"]');

    lyricsDiv.forEach((i) => (lyrics += i.innerHTML + "<br>"));

    if (!lyrics?.length) {
        console.warn("forceError");
        return null;
    }

    return lyrics;
}

Genius.prototype.fetchLyrics = async function(info, jsOnly = false) {
    const titles = new Set([info.title]);

    const titleNoExtra = Utils.removeExtraInfo(info.title);
    titles.add(titleNoExtra);
    titles.add(Utils.removeSongFeat(info.title));
    titles.add(Utils.removeSongFeat(titleNoExtra));
    console.log(titles);

    let lyrics, hits;
    for (const title of titles) {
        const url = `https://genius.com/api/search/song?per_page=20&q=${encodeURIComponent(title)}%20${encodeURIComponent(info.artist)}`;

        const geniusSearch = await CosmosAsync.get(url);

        hits = geniusSearch.response.sections[0].hits.map((item) => ({
            title: item.result.full_title,
            url: item.result.url,
        }));

        if (!hits.length) {
            continue;
        }

        lyrics = await this.fetchLyricsVersion(hits, 0);
        break;
    }

    if (!lyrics) {
        return { lyrics: null, versions: [] };
    }
    if (jsOnly) {
		let tempLyrics = (new DOMParser()).parseFromString(lyrics, "text/html").body;
		try {
			for (const element of Array.from(tempLyrics.querySelectorAll('div'))) {
				element.remove();
			};
		} catch {
			// Ignore. Intentional
		}
		
		return { lyrics: tempLyrics.innerHTML.replaceAll("<br>", "\n"), versions: hits };
    }
    return { lyrics, versions: hits };
}

globalThis.Genius = Genius;
