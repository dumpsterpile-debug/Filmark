import type { ScrapedPage } from "@shared/download";

const SCRAPE_SCRIPT = `
  (function () {
    var getText = function (el) { return el ? el.textContent.replace(/\\s+/g, ' ').trim() : ''; };
    var metaContent = function (names) {
      for (var i = 0; i < names.length; i++) {
        var el = document.querySelector(
          'meta[property="' + names[i] + '"], meta[name="' + names[i] + '"]'
        );
        if (el && el.getAttribute('content')) return el.getAttribute('content');
      }
      return '';
    };
    var host = location.hostname;
    var isIwara = /(^|\\.)iwara\\.(tv|ai)$/.test(host);
    var artist = [];
    var tags = [];
    var title = '';
    var videoId = '';
    var posterStyle = '';

    if (isIwara) {
      var a = document.querySelector('.page-video__byline__author .username');
      var name = a ? getText(a) : '';
      if (name) artist.push(name);
      tags = Array.prototype.map.call(
        document.querySelectorAll('.page-video__tags a'),
        function (x) { return x.textContent.trim(); }
      ).filter(Boolean);
      var titleEl = document.querySelector('.page-video__details .text--h1, .page-video__details h1');
      title = titleEl ? getText(titleEl) : '';
      var idMatch = location.pathname.match(/\\/video\\/([^/]+)/);
      videoId = idMatch ? idMatch[1] : '';
      var poster = document.querySelector('.vjs-poster');
      posterStyle = poster ? (poster.style && poster.style.backgroundImage) || '' : '';
    } else {
      // 通用站点（站点提取面板覆盖的其余域名）：og / twitter / keywords / <video poster> 回退
      title = metaContent(['og:title', 'twitter:title']) || getText(document.querySelector('title'));
      var keywords = metaContent(['keywords']);
      if (keywords) {
        tags = keywords.split(',')
          .map(function (t) { return t.replace(/\\s+/g, ' ').trim(); })
          .filter(Boolean);
      }
      var author = metaContent(['author', 'article:author', 'og:site_name']);
      if (author) artist.push(author);
      var posterMeta = metaContent(['og:image', 'twitter:image']);
      if (!posterMeta) {
        var videoEl = document.querySelector('video[poster]');
        posterMeta = videoEl ? videoEl.getAttribute('poster') || '' : '';
      }
      if (posterMeta) posterStyle = 'url("' + posterMeta + '")';
      var viewkey = '';
      try {
        viewkey = new URLSearchParams(location.search).get('viewkey') || '';
      } catch (e) {
        viewkey = '';
      }
      if (viewkey) {
        videoId = viewkey;
      } else {
        var segments = location.pathname.split('/').filter(Boolean);
        videoId = segments.length ? segments[segments.length - 1].replace(/\\.(html?|php)$/i, '') : '';
      }
    }

    return {
      artist: artist,
      tags: tags,
      title: title,
      videoId: videoId,
      url: location.href,
      fileName: '',
      extension: '',
      posterStyle: posterStyle
    };
  })()
`;

export async function scrapePage(webview: {
  executeJavaScript: (code: string) => Promise<unknown>;
}): Promise<ScrapedPage> {
  const result = (await webview.executeJavaScript(SCRAPE_SCRIPT)) as Partial<ScrapedPage>;
  return {
    artist: Array.isArray(result.artist) ? result.artist.map(String) : [],
    tags: Array.isArray(result.tags) ? result.tags.map(String) : [],
    title: typeof result.title === "string" ? result.title : "",
    videoId: typeof result.videoId === "string" ? result.videoId : "",
    url: typeof result.url === "string" ? result.url : "",
    fileName: "",
    extension: "",
    posterStyle: typeof result.posterStyle === "string" ? result.posterStyle : "",
  };
}
