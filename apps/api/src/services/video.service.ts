import {
  createVideoRepository,
  db,
} from "@video-assistant/db";

const videoRepository = createVideoRepository(db);

export type CreateVideoInput = {
  userId: string;
  sourceType: "youtube" | "upload";
  sourceUrl?: string;
  title?: string;
  durationSeconds?: number;
};

export async function createVideo(input: CreateVideoInput) {
  return videoRepository.create(input);
}