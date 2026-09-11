import {
  createUserRepository,
  type CreateUserInput,
} from "@video-assistant/db";

export function createUserService(
  db: Parameters<typeof createUserRepository>[0],
) {
  const userRepository = createUserRepository(db);

  return {
    async createUser(input: CreateUserInput) {
      const name = input.name.trim();

      if (!name) {
        throw new Error("User name cannot be empty");
      }

      return userRepository.create({
        name,
      });
    },

    async getUserById(id: string) {
      return userRepository.findById(id);
    },

    async listUsers() {
      return userRepository.list();
    },

    async deleteUser(id: string) {
      const user = await userRepository.findById(id);

      if (!user) {
        throw new Error(`User ${id} not found`);
      }

      return userRepository.delete(id);
    },
  };
}

