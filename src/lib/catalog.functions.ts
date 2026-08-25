import { createServerFn } from "@tanstack/react-start";
import { listBands } from "./catalog.server";

export const getBands = createServerFn({ method: "GET" }).handler(async () => {
  return listBands();
});
