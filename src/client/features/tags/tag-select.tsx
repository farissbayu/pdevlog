import { toast } from "sonner";

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/client/components/ui/multi-select";
import { ApiError } from "@/client/lib/api";
import { tagNameSchema } from "@/shared/schemas/tag";

import { useCreateTagMutation, useTagsQuery } from "./api";

type TagSelectProps = {
  id?: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function TagSelect({
  id = "tags",
  value,
  onChange,
  placeholder = "Select or create tags...",
  searchPlaceholder = "Search tags or type to create...",
  disabled,
  "aria-label": ariaLabel = "Tags",
}: TagSelectProps) {
  const { data: tags = [] } = useTagsQuery();
  const createTagMutation = useCreateTagMutation();

  const options: MultiSelectOption[] = tags.map((tag) => ({
    value: tag.id,
    label: tag.name,
  }));

  const handleCreateOption = async (name: string): Promise<string | void> => {
    const parsed = tagNameSchema.safeParse(name);
    if (!parsed.success) {
      toast.error("Tag name must be 50 characters or less");
      return;
    }

    try {
      const created = await createTagMutation.mutateAsync({ name: parsed.data });
      toast.success(`Tag "${created.name}" created`);
      return created.id;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const existing = tags.find(
          (tag) => tag.name.toLowerCase() === parsed.data.toLowerCase(),
        );
        if (existing) {
          return existing.id;
        }
      }
      toast.error(error instanceof Error ? error.message : "Failed to create tag");
    }
  };

  return (
    <MultiSelect
      id={id}
      aria-label={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No tags yet. Type a name to create one."
      disabled={disabled}
      onCreateOption={handleCreateOption}
    />
  );
}
