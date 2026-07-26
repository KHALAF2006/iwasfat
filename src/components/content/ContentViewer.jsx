import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExternalLink, Download } from "lucide-react";
import { useT } from "@/i18n";

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const embedMatch = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]+)/);
      if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[2]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function getVimeoEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectMediaUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i.test(url);
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^https?:\/\//i.test(url.trim());
}

function FileLinkButton({ url, t }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <ExternalLink className="w-4 h-4" />
      {t("contentViewer.openFile")}
      <Download className="w-4 h-4" />
    </a>
  );
}

function Unavailable({ t }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-secondary/50 px-4 py-10 text-sm text-muted-foreground">
      {t("contentViewer.unavailable")}
    </div>
  );
}

function MediaBody({ item, t }) {
  const type = item.content_type;

  if (type === "video") {
    const videoUrl = item.video_url;
    const embedUrl = getYouTubeEmbedUrl(videoUrl) || getVimeoEmbedUrl(videoUrl);
    if (embedUrl) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={embedUrl}
            title={item.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (isValidUrl(videoUrl) && isDirectMediaUrl(videoUrl)) {
      return (
        <video
          controls
          playsInline
          src={videoUrl}
          className="w-full rounded-xl bg-black"
          poster={item.thumbnail || undefined}
        />
      );
    }
    if (isValidUrl(item.file_url)) {
      return (
        <div className="flex justify-center py-4">
          <FileLinkButton url={item.file_url} t={t} />
        </div>
      );
    }
    return <Unavailable t={t} />;
  }

  if (type === "image" || type === "infographic") {
    const src = isValidUrl(item.file_url) ? item.file_url : isValidUrl(item.thumbnail) ? item.thumbnail : null;
    if (src) {
      return (
        <img
          src={src}
          alt={item.title}
          className="w-full rounded-xl object-contain"
        />
      );
    }
    return <Unavailable t={t} />;
  }

  // pdf or any other file type
  if (isValidUrl(item.file_url)) {
    return (
      <div className="flex justify-center py-4">
        <FileLinkButton url={item.file_url} t={t} />
      </div>
    );
  }
  return <Unavailable t={t} />;
}

export default function ContentViewer({ item, open, onOpenChange }) {
  const t = useT();
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-start pe-8">{item.title}</DialogTitle>
          {item.description && (
            <DialogDescription className="text-start">{item.description}</DialogDescription>
          )}
        </DialogHeader>
        <MediaBody item={item} t={t} />
      </DialogContent>
    </Dialog>
  );
}
