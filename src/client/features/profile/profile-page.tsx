import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCode,
  FileText,
  Loader2,
  Plus,
  Save,
  Sparkles,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "cn";

import { MarkdownRenderer } from "@/client/components/markdown-renderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/client/components/ui/avatar";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";

import {
  isProfileProcessing,
  profileQueryOptions,
  useAnalyzeSkillsMutation,
  useExtractPersonaMutation,
  useUpdateProfileMutation,
  useUploadCvMutation,
} from "./api";
import { SkillInsightsView } from "./components/skill-insights-view";

const RECOMMENDED_STACK = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Cloudflare Workers",
  "Drizzle ORM",
  "PostgreSQL",
  "Tailwind CSS",
  "GraphQL",
  "AI / LLMs",
];

export type ProfileTab = "skills" | "cv" | "persona";

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ProfileTab =
    rawTab === "cv" ? "cv" : rawTab === "persona" ? "persona" : "skills";

  const { data: profile, isLoading, error } = useQuery(profileQueryOptions());
  const updateProfileMutation = useUpdateProfileMutation();
  const uploadCvMutation = useUploadCvMutation();
  const analyzeSkillsMutation = useAnalyzeSkillsMutation();
  const extractPersonaMutation = useExtractPersonaMutation();

  // Form states
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [primaryStack, setPrimaryStack] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [cvMarkdown, setCvMarkdown] = useState("");
  const [cvViewTab, setCvViewTab] = useState<"preview" | "edit">("preview");

  // Drag & drop file upload
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track initial load and server extracted timestamp so refetches do not wipe local edits
  const initialLoadedRef = useRef(false);
  const lastExtractedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (!initialLoadedRef.current) {
      setHeadline(profile.headline ?? "");
      setBio(profile.bio ?? "");
      setPrimaryStack(profile.primaryStack ?? []);
      setCvMarkdown(profile.cvMarkdown ?? "");
      lastExtractedAtRef.current = profile.cvExtractedAt;
      initialLoadedRef.current = true;
    } else if (
      profile.cvExtractedAt &&
      profile.cvExtractedAt !== lastExtractedAtRef.current
    ) {
      // When a new file is uploaded and extracted on server, sync the new markdown and persona
      setCvMarkdown(profile.cvMarkdown ?? "");
      if (profile.headline) setHeadline(profile.headline);
      if (profile.bio) setBio(profile.bio);
      if (profile.primaryStack?.length) setPrimaryStack(profile.primaryStack);
      lastExtractedAtRef.current = profile.cvExtractedAt;
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm font-medium text-foreground">
          Failed to load profile
        </p>
      </div>
    );
  }

  const processing = isProfileProcessing(profile);
  const uploading =
    uploadCvMutation.isPending ||
    (processing && profile.cvParseStatus === "processing");
  const analyzing =
    analyzeSkillsMutation.isPending ||
    (processing && profile.insightsStatus === "analyzing");

  const handleTabChange = (newTab: ProfileTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newTab === "skills") {
          next.set("tab", "skills");
        } else {
          next.set("tab", newTab);
        }
        return next;
      },
      { replace: false },
    );
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(
      {
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        primaryStack,
        cvMarkdown: cvMarkdown.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Profile saved successfully!");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to save profile");
        },
      },
    );
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !primaryStack.includes(trimmed)) {
      setPrimaryStack([...primaryStack, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setPrimaryStack(primaryStack.filter((t) => t !== tag));
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadCv = () => {
    if (!selectedFile) return;

    uploadCvMutation.mutate(selectedFile, {
      onSuccess: () => {
        setSelectedFile(null);
        toast.success(
          "CV uploaded. Extracting & formatting in the background...",
        );
      },
      onError: (err) => {
        toast.error(err.message || "Failed to extract CV");
      },
    });
  };

  const handleExtractPersonaFromCv = () => {
    extractPersonaMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.headline) setHeadline(res.headline);
        if (res.bio) setBio(res.bio);
        if (res.primaryStack?.length) setPrimaryStack(res.primaryStack);
        toast.success(
          "Headline, executive bio, and stack synced from CV!",
        );
      },
      onError: (err) => {
        toast.error(err.message || "Failed to extract persona details from CV");
      },
    });
  };

  const handleAnalyzeSkills = async () => {
    // Auto-save local markdown edits to DB first so AI audits latest content
    if (cvMarkdown.trim() !== (profile?.cvMarkdown ?? "").trim()) {
      try {
        await updateProfileMutation.mutateAsync({
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          primaryStack,
          cvMarkdown: cvMarkdown.trim() || null,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to save latest changes before analyzing";
        toast.error(msg);
        return;
      }
    }

    analyzeSkillsMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Analyzing your engineering competencies...");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to analyze skills");
      },
    });
  };

  const tabs = [
    {
      id: "skills" as const,
      label: "Skill & Growth Insights",
      icon: Sparkles,
      badge: profile.skillInsights ? "Active" : undefined,
    },
    {
      id: "cv" as const,
      label: "Resume & CV Intelligence",
      icon: FileText,
      badge: profile.cvExtractedAt ? "Extracted" : undefined,
    },
    {
      id: "persona" as const,
      label: "Persona & Stack",
      icon: User,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Engineer Profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your developer persona, resume intelligence, and engineering
            competency baseline.
          </p>
        </div>
        {activeTab !== "skills" && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="gap-2"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Profile
            </Button>
          </div>
        )}
      </div>

      {/* Identity Summary Card */}
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-border">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.name} />
              ) : null}
              <AvatarFallback className="text-lg font-bold">
                {profile.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {profile.name}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Google Connected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
              {headline && (
                <p className="text-xs font-medium text-foreground/90">
                  {headline}
                </p>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground sm:text-right">
            <span>
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.2 text-[10px] font-mono",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Skill & Growth Insights */}
      {activeTab === "skills" && (
        <SkillInsightsView
          insights={profile.skillInsights}
          analyzedAt={profile.skillAnalyzedAt}
          onAnalyze={handleAnalyzeSkills}
          isAnalyzing={analyzing}
          onNavigateToCv={() => handleTabChange("cv")}
          hasCvContent={Boolean(cvMarkdown && cvMarkdown.trim().length >= 50)}
        />
      )}

      {/* Tab 2: Resume & CV Intelligence */}
      {activeTab === "cv" && (
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Resume &amp; CV Intelligence
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your CV as PDF or Markdown. We extract clean Markdown directly
              into SQLite, saving over 98% database storage while enabling AI to
              evaluate your technical superpowers and growth areas.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/70 hover:border-primary/50",
            )}
          >
            <UploadCloud className="size-10 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">
              {selectedFile
                ? selectedFile.name
                : "Drag & drop your resume PDF or Markdown"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports PDF, .md, and .txt files (max 10MB)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.markdown,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
              {selectedFile && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUploadCv}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {uploading ? "Extracting..." : "Extract & Format to Markdown"}
                </Button>
              )}
            </div>
          </div>

          {/* Analyze Insights Callout Banner */}
          {cvMarkdown.trim().length > 50 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    <h3 className="font-semibold text-foreground">
                      {profile.skillInsights
                        ? "Re-evaluate Competency Insights"
                        : "Analyze Competency Insights from CV"}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                    Our AI synthesizes your CV experience to highlight your core
                    engineering superpowers, identify unproven blind spots, and
                    recommend high-impact projects for career progression.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={handleAnalyzeSkills}
                    disabled={analyzing}
                    className="gap-2"
                  >
                    {analyzing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {analyzing
                      ? "Analyzing..."
                      : profile.skillInsights
                        ? "Re-analyze Skills"
                        : "Analyze Skills & Growth"}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleTabChange("skills")}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-4" />
                    View Insights
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Live Processing Indicator */}
              {analyzing && (
                <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-background/80 p-3 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                  <span>
                    Evaluating CV experience to synthesize your engineering
                    superpowers and growth opportunities... (usually takes 10-20
                    seconds)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CV Markdown Editor / Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">CV Markdown Content</Label>
                {profile.cvExtractedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Extracted{" "}
                    {new Date(profile.cvExtractedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCvViewTab("preview")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                    cvViewTab === "preview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileText className="size-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setCvViewTab("edit")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                    cvViewTab === "edit"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileCode className="size-3.5" />
                  Edit Raw
                </button>
              </div>
            </div>

            {cvViewTab === "preview" ? (
              <div className="matcha-scroll min-h-72 max-h-[500px] overflow-y-auto rounded-xl border bg-muted/20 p-5">
                {cvMarkdown.trim() ? (
                  <MarkdownRenderer content={cvMarkdown} />
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <FileText className="size-8 opacity-40" />
                    <p className="text-xs">
                      No CV content yet. Upload your CV above or click &ldquo;Edit
                      Raw&rdquo; to paste your markdown.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  rows={16}
                  className="matcha-scroll font-mono text-xs leading-relaxed"
                  placeholder="# John Doe - Senior Product Engineer&#10;&#10;## Summary&#10;..."
                  value={cvMarkdown}
                  onChange={(e) => setCvMarkdown(e.target.value)}
                />
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>{cvMarkdown.length} characters</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="gap-1 text-xs"
                  >
                    <Save className="size-3.5" />
                    Save Markdown
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Persona & Stack */}
      {activeTab === "persona" && (
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <User className="size-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  Persona &amp; Tech Stack
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Define your professional headline, career bio, and core technologies
                to contextualize your engineering work and AI reflections.
              </p>
            </div>
            {profile.cvMarkdown && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractPersonaFromCv}
                disabled={extractPersonaMutation.isPending}
                className="gap-1.5 text-xs shrink-0 self-start sm:self-auto border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                {extractPersonaMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="size-3.5 text-primary" />
                )}
                Auto-fill from CV
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="headline">Professional Headline</Label>
                {profile.skillInsights?.archetype && !headline && (
                  <button
                    type="button"
                    onClick={() => setHeadline(profile.skillInsights!.archetype)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="size-3" />
                    Use Archetype
                  </button>
                )}
              </div>
              <Input
                id="headline"
                placeholder="e.g. Senior Product Engineer / Fullstack Lead"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bio">Executive Bio</Label>
                {profile.skillInsights?.summary && !bio && (
                  <button
                    type="button"
                    onClick={() => setBio(profile.skillInsights!.summary)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="size-3" />
                    Use Skill Insights summary
                  </button>
                )}
              </div>
              <Textarea
                id="bio"
                rows={3}
                placeholder="Brief summary of your focus, philosophies, and domain expertise..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          {/* Primary Stack */}
          <div className="space-y-2 border-t pt-4">
            <Label>Primary Stack &amp; Core Tools</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {primaryStack.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="rounded-full p-0.5 hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1 sm:max-w-md">
              <Input
                placeholder="Add technology (e.g. Drizzle, Tailwind)..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                className="gap-1"
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>Suggestions:</span>
              {RECOMMENDED_STACK.filter((s) => !primaryStack.includes(s))
                .slice(0, 6)
                .map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => setPrimaryStack([...primaryStack, rec])}
                    className="rounded border border-dashed px-1.5 py-0.5 text-[11px] hover:border-primary hover:text-foreground"
                  >
                    + {rec}
                  </button>
                ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="gap-2"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Persona Details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
