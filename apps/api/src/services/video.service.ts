import {
  createVideoRepository,
  type Database,
} from "@video-assistant/db";

export type CreateVideoInput = {
  userId: string;
  sourceType: "upload" | "remote_url";
  storageKey?: string;
  sourceUrl?: string;
  title?: string;
  durationSeconds?: number;
};

export function createVideoService(
  db: Database,
) {
  const videoRepository =
    createVideoRepository(db);

  return {
    async createVideo(
      input: CreateVideoInput,
    ) {
      if (
        input.sourceType === "upload" &&
        !input.storageKey
      ) {
        throw new Error(
          "Uploaded videos require a storage key",
        );
      }

      if (
        input.sourceType === "remote_url" &&
        !input.sourceUrl
      ) {
        throw new Error(
          "Remote videos require a source URL",
        );
      }

      return videoRepository.create(input);
    },

    async findById(id: string) {
      return videoRepository.findById(id);
    },
  };
}