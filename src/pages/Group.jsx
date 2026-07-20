import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Image as ImageIcon, ThumbsUp, Heart, Dumbbell, Users, Loader2 } from "lucide-react";
import moment from "moment";
import { useT } from "@/i18n";

const POST_TYPE_KEYS = ["general", "meal", "progress", "question"];

export default function Group() {
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [postType, setPostType] = useState("general");
  const [imageFile, setImageFile] = useState(null);
  const t = useT();

  const { data: subscriber } = useQuery({
    queryKey: ["subscriber"],
    queryFn: async () => {
      const subs = await base44.entities.Subscriber.filter({ created_by: (await base44.auth.me()).email });
      return subs[0] || null;
    },
  });

  const { data: group } = useQuery({
    queryKey: ["group", subscriber?.group_id],
    queryFn: () => base44.entities.Group.filter({ id: subscriber.group_id }),
    enabled: !!subscriber?.group_id,
    select: (data) => data[0],
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["groupPosts", subscriber?.group_id],
    queryFn: () => base44.entities.GroupPost.filter({ group_id: subscriber.group_id }, "-created_date"),
    enabled: !!subscriber?.group_id,
  });

  const postMutation = useMutation({
    mutationFn: async (postData) => {
      let imageUrl = null;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        imageUrl = file_url;
      }
      return base44.entities.GroupPost.create({
        ...postData,
        image_url: imageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupPosts"] });
      setNewPost("");
      setImageFile(null);
    },
  });

  const handlePost = () => {
    if (!newPost.trim()) return;
    postMutation.mutate({
      group_id: subscriber.group_id,
      subscriber_id: subscriber.id,
      subscriber_name: subscriber.full_name,
      content: newPost,
      post_type: postType,
      reactions: { likes: 0, hearts: 0, muscle: 0 },
    });
  };

  const handleReact = async (post, type) => {
    const reactions = { ...post.reactions };
    reactions[type] = (reactions[type] || 0) + 1;
    await base44.entities.GroupPost.update(post.id, { reactions });
    queryClient.invalidateQueries({ queryKey: ["groupPosts"] });
  };

  if (!subscriber?.group_id) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto text-center">
        <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">{t("group.title")}</h1>
        <p className="text-muted-foreground">{t("group.noGroup")}</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">{group?.name || t("group.title")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{group?.description || ""}</p>

      {/* New Post */}
      <div className="bg-card rounded-2xl border border-border/50 p-4 mb-6">
        <Textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder={t("group.placeholder")}
          className="mb-3 resize-none"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPE_KEYS.map(key => (
                  <SelectItem key={key} value={key}>{t(`group.types.${key}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="cursor-pointer">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <span><ImageIcon className="w-4 h-4" /></span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files[0])} />
            </label>
            {imageFile && <span className="text-xs text-primary">{t("group.imageAttached")}</span>}
          </div>
          <Button size="sm" onClick={handlePost} disabled={!newPost.trim() || postMutation.isPending} className="bg-primary text-primary-foreground gap-1">
            {postMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {t("group.publish")}
          </Button>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="bg-card rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">{post.subscriber_name?.[0] || "👤"}</span>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{post.subscriber_name}</p>
                <p className="text-xs text-muted-foreground">{moment(post.created_date).fromNow()}</p>
              </div>
              <span className="ms-auto text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                {t(`group.types.${post.post_type}`)}
              </span>
            </div>

            <p className="text-foreground text-sm leading-relaxed mb-3">{post.content}</p>

            {post.image_url && (
              <img src={post.image_url} alt="" className="rounded-xl w-full aspect-video object-cover mb-3" />
            )}

            <div className="flex gap-4 text-muted-foreground">
              <button onClick={() => handleReact(post, "likes")} className="flex items-center gap-1 text-xs hover:text-primary transition-colors">
                <ThumbsUp className="w-4 h-4" /> {post.reactions?.likes || 0}
              </button>
              <button onClick={() => handleReact(post, "hearts")} className="flex items-center gap-1 text-xs hover:text-red-500 transition-colors">
                <Heart className="w-4 h-4" /> {post.reactions?.hearts || 0}
              </button>
              <button onClick={() => handleReact(post, "muscle")} className="flex items-center gap-1 text-xs hover:text-accent transition-colors">
                <Dumbbell className="w-4 h-4" /> {post.reactions?.muscle || 0}
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {t("group.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
