import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Image, FileText, Clock, Bookmark, BookOpen } from "lucide-react";

const CATEGORIES = {
  all: "الكل",
  nutrition: "التغذية",
  exercise: "التمارين",
  shopping: "التسوق",
  appetite: "الشهية",
  motivation: "تحفيز",
};

const TYPE_ICONS = {
  video: Play,
  image: Image,
  infographic: Image,
  pdf: FileText,
};

export default function Content() {
  const [category, setCategory] = useState("all");

  const { data: content = [] } = useQuery({
    queryKey: ["content"],
    queryFn: () => base44.entities.ContentItem.filter({ is_published: true }, "-publish_date"),
  });

  const filtered = category === "all" ? content : content.filter(c => c.category === category);

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">المحتوى التعليمي</h1>
      <p className="text-muted-foreground text-sm mb-6">فيديوهات ونصائح لدعم رحلتك</p>

      {/* Category Tabs */}
      <div className="overflow-x-auto mb-6 -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                category === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="space-y-4">
        {filtered.length > 0 ? filtered.map(item => {
          const Icon = TYPE_ICONS[item.content_type] || FileText;
          return (
            <div key={item.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden hover:shadow-md transition-shadow">
              {(item.thumbnail || item.file_url) && item.content_type !== "pdf" && (
                <div className="relative aspect-video bg-secondary">
                  <img src={item.thumbnail || item.file_url} alt={item.title} className="w-full h-full object-cover" />
                  {item.content_type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-foreground mr-[-2px]" />
                      </div>
                    </div>
                  )}
                  {item.duration_minutes && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.duration_minutes} دقائق
                    </div>
                  )}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{CATEGORIES[item.category] || item.category}</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p>لا يوجد محتوى متاح حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}